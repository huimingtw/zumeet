package service

import (
	"context"
	"io"
)

type StorageService interface {
	Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (url string, err error)
	Delete(ctx context.Context, key string) error
}
