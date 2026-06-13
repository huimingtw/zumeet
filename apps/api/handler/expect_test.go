package handler_test

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	httpexpect "github.com/gavv/httpexpect/v2"
)

const testBaseURL = "http://localhost:8080"

// newExpect returns an httpexpect.Expect wired to the in-process testR.
func newExpect(t *testing.T) *httpexpect.Expect {
	t.Helper()
	return httpexpect.WithConfig(httpexpect.Config{
		BaseURL: testBaseURL,
		Client: &http.Client{
			Jar:       httpexpect.NewCookieJar(),
			Timeout:   5 * time.Second,
			Transport: NewBinder(testR),
		},
		Reporter: httpexpect.NewFatalReporter(t),
	})
}

// newExpectWithCookie returns an Expect with a pre-set auth cookie.
func newExpectWithCookie(t *testing.T, cookie *http.Cookie) *httpexpect.Expect {
	t.Helper()
	jar := httpexpect.NewCookieJar()
	u, _ := url.Parse(testBaseURL)
	jar.SetCookies(u, []*http.Cookie{cookie})
	return httpexpect.WithConfig(httpexpect.Config{
		BaseURL: testBaseURL,
		Client: &http.Client{
			Jar:       jar,
			Timeout:   5 * time.Second,
			Transport: NewBinder(testR),
		},
		Reporter: httpexpect.NewFatalReporter(t),
	})
}
