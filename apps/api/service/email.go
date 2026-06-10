package service

import "context"

type EmailService interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}
