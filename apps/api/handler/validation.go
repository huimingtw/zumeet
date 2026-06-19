package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// FieldError is the per-field validation error returned to the client.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// CodeValidationFailed and CodeInvalidFormat are the only two error codes for binding.
const (
	CodeValidationFailed = "VALIDATION_FAILED"
	CodeInvalidFormat    = "INVALID_FORMAT"
)

// fieldLabels maps json tag → 中文 label for fields that actually fire validation.
// Booleans and optional-only fields fall back to the raw field name.
var fieldLabels = map[string]string{
	"name":                 "名稱",
	"contact_info":         "聯絡方式",
	"city":                 "縣市",
	"district":             "區域",
	"role":                 "身分",
	"budget_min":           "最低預算",
	"budget_max":           "最高預算",
	"locations":            "可接受地區",
	"preferred_room_types": "偏好房型",
	"available_from":       "最快入住日",
	"min_lease_months":     "最短租期（月）",
	"min_area_ping":        "最小坪數",
	"rent":                 "房租",
	"room_type":            "房型",
	"area_ping":            "坪數",
	"reported_id":          "被檢舉對象",
	"reason":               "原因",
}

func labelFor(field string) string {
	if l, ok := fieldLabels[field]; ok {
		return l
	}
	return field
}

// messageFor turns a single FieldError from the validator into a Chinese message.
func messageFor(fe validator.FieldError) string {
	label := labelFor(fe.Field())
	switch fe.Tag() {
	case "required":
		return "請填寫" + label
	case "min":
		// For numeric fields use 「不可小於」, for slices use 「至少選擇 N 項」
		switch fe.Kind().String() {
		case "slice", "array", "map":
			return label + "至少選擇 " + fe.Param() + " 項"
		default:
			return label + "不可小於 " + fe.Param()
		}
	case "max":
		switch fe.Kind().String() {
		case "slice", "array", "map":
			return label + "最多 " + fe.Param() + " 項"
		default:
			return label + "不可大於 " + fe.Param()
		}
	case "email":
		return label + "格式錯誤"
	case "oneof":
		return label + "不是有效選項"
	default:
		return label + "格式不正確"
	}
}

// bindJSON parses the request body into req. On failure it writes the JSON
// error response and returns false — the handler should just `return` after that.
//
// The shape of the error response is:
//
//	{ "error": "...", "code": "VALIDATION_FAILED", "fields": [{field, message}] }
//
// Raw validator/json errors are NEVER returned to the client.
func bindJSON(c *Context, req any) bool {
	if err := c.ShouldBindJSON(req); err != nil {
		respondBindError(c, err)
		return false
	}
	return true
}

func respondBindError(c *Context, err error) {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		fields := make([]FieldError, 0, len(ve))
		for _, fe := range ve {
			fields = append(fields, FieldError{
				Field:   fe.Field(),
				Message: messageFor(fe),
			})
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "請檢查表單欄位",
			"code":   CodeValidationFailed,
			"fields": fields,
		})
		return
	}
	var ute *json.UnmarshalTypeError
	if errors.As(err, &ute) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "資料格式錯誤",
			"code":   CodeInvalidFormat,
			"fields": []FieldError{{Field: ute.Field, Message: labelFor(ute.Field) + "格式不正確"}},
		})
		return
	}
	var se *json.SyntaxError
	if errors.As(err, &se) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "資料格式錯誤", "code": CodeInvalidFormat})
		return
	}
	// Fallback: generic message, never leak err.Error()
	c.JSON(http.StatusBadRequest, gin.H{"error": "資料格式錯誤", "code": CodeInvalidFormat})
}

// respondFieldError writes a single-field validation error response. Use for
// custom validators that run after bindJSON succeeds.
func respondFieldError(c *Context, field, message string) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error": message,
		"code":  CodeValidationFailed,
		"fields": []FieldError{
			{Field: field, Message: message},
		},
	})
}

// respondFieldErrors writes multiple field errors.
func respondFieldErrors(c *Context, fields []FieldError) {
	msg := "請檢查表單欄位"
	if len(fields) == 1 {
		msg = fields[0].Message
	}
	c.JSON(http.StatusBadRequest, gin.H{
		"error":  msg,
		"code":   CodeValidationFailed,
		"fields": fields,
	})
}

