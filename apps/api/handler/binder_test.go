package handler_test

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
)

// Binder is an http.RoundTripper that routes requests directly to the in-process
// Gin router via httptest.NewRecorder, eliminating the need for a real HTTP server.
type Binder struct {
	Handler http.Handler
	TLS     *tls.ConnectionState
}

func NewBinder(h http.Handler) Binder {
	return Binder{Handler: h}
}

func (b Binder) RoundTrip(origReq *http.Request) (*http.Response, error) {
	req := *origReq
	if req.Proto == "" {
		req.Proto = fmt.Sprintf("HTTP/%d.%d", req.ProtoMajor, req.ProtoMinor)
	}
	if req.Body == nil || req.Body == http.NoBody {
		req.Body = http.NoBody
	}
	if req.URL != nil && req.URL.Scheme == "https" && b.TLS != nil {
		req.TLS = b.TLS
	}
	if req.RequestURI == "" {
		req.RequestURI = req.URL.RequestURI()
	}
	if req.Host == "" {
		req.Host = "localhost:8080"
	}
	req.RemoteAddr = "127.0.0.1:8080"

	w := httptest.NewRecorder()
	b.Handler.ServeHTTP(w, &req)

	resp := http.Response{
		Request:    &req,
		StatusCode: w.Code,
		Status:     http.StatusText(w.Code),
		Header:     w.Result().Header,
	}
	if w.Body != nil {
		resp.Body = io.NopCloser(w.Body)
	}
	return &resp, nil
}
