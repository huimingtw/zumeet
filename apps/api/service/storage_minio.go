package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioStorageService struct {
	client    *minio.Client
	bucket    string
	endpoint  string
	publicURL string // overrides endpoint in generated URLs (e.g. localhost vs docker hostname)
	useSSL    bool
}

// pathPrefixTransport prepends a fixed path prefix to every S3 request.
// Needed for S3-compatible APIs that serve under a subpath (e.g. Supabase: /storage/v1/s3).
type pathPrefixTransport struct {
	base   http.RoundTripper
	prefix string
}

func (t *pathPrefixTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.URL.Path = t.prefix + req.URL.Path
	if req.URL.RawPath != "" {
		req.URL.RawPath = t.prefix + req.URL.RawPath
	}
	return t.base.RoundTrip(req)
}

// NewMinioStorageService accepts endpoint as either a bare host ("host:port")
// or a full URL ("https://host/path/prefix"). In the latter case the path is
// used as a prefix on every request so that Supabase-style endpoints work.
func NewMinioStorageService(endpoint, publicURL, accessKey, secretKey, bucket string, useSSL bool) (*MinioStorageService, error) {
	host := endpoint
	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	}

	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		u, err := url.Parse(endpoint)
		if err != nil {
			return nil, fmt.Errorf("minio client: invalid endpoint URL: %w", err)
		}
		host = u.Host
		opts.Secure = u.Scheme == "https"
		if prefix := strings.TrimRight(u.Path, "/"); prefix != "" {
			opts.Transport = &pathPrefixTransport{base: http.DefaultTransport, prefix: prefix}
		}
	}

	client, err := minio.New(host, opts)
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}
	return &MinioStorageService{
		client:    client,
		bucket:    bucket,
		endpoint:  endpoint,
		publicURL: publicURL,
		useSSL:    useSSL,
	}, nil
}

func (s *MinioStorageService) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	// Ensure bucket exists
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return "", fmt.Errorf("check bucket: %w", err)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return "", fmt.Errorf("make bucket: %w", err)
		}
		// Set public read policy
		policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, s.bucket)
		if err := s.client.SetBucketPolicy(ctx, s.bucket, policy); err != nil {
			return "", fmt.Errorf("set bucket policy: %w", err)
		}
	}

	_, err = s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("put object: %w", err)
	}

	base := s.publicURL
	if base == "" {
		scheme := "http"
		if s.useSSL {
			scheme = "https"
		}
		base = fmt.Sprintf("%s://%s", scheme, s.endpoint)
	}
	return fmt.Sprintf("%s/%s/%s", base, s.bucket, key), nil
}

func (s *MinioStorageService) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}
