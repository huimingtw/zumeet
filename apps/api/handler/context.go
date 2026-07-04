package handler

import (
	"fmt"
	"runtime"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

const HandlerCallerKey = "hcaller"

type Context struct {
	*gin.Context
	logger *zap.Logger
}

type HandlerFunc func(*Context)

type ContextTransformer struct {
	logger *zap.Logger
}

func NewContextTransformer(logger *zap.Logger) *ContextTransformer {
	return &ContextTransformer{logger: logger}
}

func (transformer *ContextTransformer) WithAppContext(fn HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		fn(&Context{Context: c, logger: transformer.logger})
	}
}

func (c *Context) JSON(code int, obj any) {
	_, file, line, ok := runtime.Caller(1)
	if ok {
		c.Set(HandlerCallerKey, fmt.Sprintf("%s:%d", file, line))
	}
	c.Context.JSON(code, obj)
}
