package service

import (
	"context"
	"fmt"

	"github.com/resend/resend-go/v2"
)

type ResendEmailService struct {
	client   *resend.Client
	fromAddr string
}

func NewResendEmailService(apiKey, fromAddr string) *ResendEmailService {
	return &ResendEmailService{
		client:   resend.NewClient(apiKey),
		fromAddr: fromAddr,
	}
}

func (s *ResendEmailService) Send(ctx context.Context, to, subject, htmlBody string) error {
	_, err := s.client.Emails.Send(&resend.SendEmailRequest{
		From:    s.fromAddr,
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	})
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	return nil
}

// NoopEmailService records sent emails without actually sending (used in tests).
type NoopEmailService struct {
	Sent []SentEmail
}

type SentEmail struct {
	To      string
	Subject string
	Body    string
}

func (s *NoopEmailService) Send(_ context.Context, to, subject, htmlBody string) error {
	s.Sent = append(s.Sent, SentEmail{To: to, Subject: subject, Body: htmlBody})
	return nil
}
