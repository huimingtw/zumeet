package service

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type MinioStorageService struct {
	client    *s3.Client
	bucket    string
	publicURL string // base URL for generating public object URLs
}

// NewMinioStorageService accepts endpoint as a bare host ("host:port") or a full
// URL ("https://host/base/path"). AWS SDK Go v2 signs requests with the full
// canonical URI, so endpoints with path prefixes (e.g. Supabase /storage/v1/s3)
// work correctly — unlike the MinIO SDK which rejects them.
func NewMinioStorageService(endpoint, publicURL, accessKey, secretKey, bucket string, useSSL bool) (*MinioStorageService, error) {
	endpointURL := endpoint
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		scheme := "http"
		if useSSL {
			scheme = "https"
		}
		endpointURL = scheme + "://" + endpoint
	}

	cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		awsconfig.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("aws config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpointURL)
		o.UsePathStyle = true
	})

	return &MinioStorageService{
		client:    client,
		bucket:    bucket,
		publicURL: publicURL,
	}, nil
}

func (s *MinioStorageService) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          r,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("put object: %w", err)
	}

	if s.publicURL != "" {
		return fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.publicURL, "/"), s.bucket, key), nil
	}
	return key, nil
}

func (s *MinioStorageService) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}
