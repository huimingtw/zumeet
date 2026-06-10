package models

import "time"

type User struct {
	ID          string
	Email       string
	IsVerified  bool
	SuspendedAt *time.Time
	DeletedAt   *time.Time
	CreatedAt   time.Time
}
