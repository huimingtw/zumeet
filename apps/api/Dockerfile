FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /api .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /api /api
COPY --from=builder /app/db /db

EXPOSE 8080

ENTRYPOINT ["/api"]
