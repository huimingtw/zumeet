package dblogger

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/zumeet/api/middleware"
)

type pgxTraceKey struct{}

type pgxQueryTrace struct {
	sql   string
	args  []any
	start time.Time
}

// PgxTracer implements pgx.QueryTracer and logs every SQL query via zap.
type PgxTracer struct {
	logger        *zap.Logger
	slowThreshold time.Duration
	spacesRe      *regexp.Regexp
}

func NewPgxTracer(logger *zap.Logger, slowThreshold time.Duration) *PgxTracer {
	return &PgxTracer{
		logger:        logger,
		slowThreshold: slowThreshold,
		spacesRe:      regexp.MustCompile(`\s+`),
	}
}

func (t *PgxTracer) normalize(sql string) string {
	return t.spacesRe.ReplaceAllString(strings.ReplaceAll(sql, "\n", " "), " ")
}

// interpolate replaces $1, $2, ... placeholders with quoted actual values.
func interpolate(sql string, args []any) string {
	for i, arg := range args {
		placeholder := fmt.Sprintf("$%d", i+1)
		var val string
		if arg == nil {
			val = "NULL"
		} else {
			val = fmt.Sprintf("'%v'", arg)
		}
		sql = strings.ReplaceAll(sql, placeholder, val)
	}
	return sql
}

func (t *PgxTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, pgxTraceKey{}, &pgxQueryTrace{
		sql:   data.SQL,
		args:  data.Args,
		start: time.Now(),
	})
}

func (t *PgxTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	qt, ok := ctx.Value(pgxTraceKey{}).(*pgxQueryTrace)
	if !ok {
		return
	}

	elapsed := time.Since(qt.start)
	rid := middleware.RequestIDFromContext(ctx)

	fields := []zap.Field{
		zap.String("request_id", rid),
		zap.String("sql", interpolate(t.normalize(qt.sql), qt.args)),
		zap.Duration("elapsed", elapsed),
		zap.Int64("rows", data.CommandTag.RowsAffected()),
	}

	if data.Err != nil {
		fields = append(fields, zap.Error(data.Err))
		t.logger.Error("pgx query", fields...)
		return
	}

	if t.slowThreshold > 0 && elapsed >= t.slowThreshold {
		t.logger.Warn("pgx slow query", fields...)
		return
	}

	t.logger.Info("pgx query", fields...)
}
