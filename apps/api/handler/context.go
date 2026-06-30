package handler

import (
	"fmt"
	"runtime"

	"github.com/gin-gonic/gin"
)

const HandlerCallerKey = "hcaller"

type Context struct {
	*gin.Context
}

type HandlerFunc func(*Context)

type ContextTransformer struct{}

func NewContextTransformer() *ContextTransformer {
	return &ContextTransformer{}
}

// WithAppContext adapts a HandlerFunc to a gin.HandlerFunc by boxing the request
// *gin.Context into the app's *Context wrapper (whose JSON() captures caller file:line
// for logging). Used by every route, authed or not.
func (transformer *ContextTransformer) WithAppContext(fn HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		fn(&Context{Context: c})
	}
}

func (c *Context) JSON(code int, obj any) {
	_, file, line, ok := runtime.Caller(1)
	if ok {
		c.Set(HandlerCallerKey, fmt.Sprintf("%s:%d", file, line))
	}
	c.Context.JSON(code, obj)
}
