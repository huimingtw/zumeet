package service

import (
	"context"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioStorageService struct {
	client   *minio.Client
	bucket   string
	endpoint string
	useSSL   bool
}

func NewMinioStorageService(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*MinioStorageService, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}
	return &MinioStorageService{
		client:   client,
		bucket:   bucket,
		endpoint: endpoint,
		useSSL:   useSSL,
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

	scheme := "http"
	if s.useSSL {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, s.endpoint, s.bucket, key), nil
}

func (s *MinioStorageService) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}
