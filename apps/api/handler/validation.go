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

// fieldLabels maps json tag → 中文 label. Keep in sync with request struct tags.
var fieldLabels = map[string]string{
	// shared
	"name":         "名稱",
	"contact_info": "聯絡方式",
	"city":         "縣市",
	"district":     "區域",
	"address":      "地址",
	"description":  "說明",
	"role":         "身分",

	// tenant profile
	"budget_min":                   "最低預算",
	"budget_max":                   "最高預算",
	"locations":                    "可接受地區",
	"preferred_room_types":         "偏好房型",
	"available_from":               "最快入住日",
	"min_lease_months":             "最短租期（月）",
	"min_area_ping":                "最小坪數",
	"has_pets":                     "是否養寵物",
	"pet_description":              "寵物說明",
	"needs_subsidy":                "需要租屋補助",
	"needs_tax_receipt":            "需要租賃稅單",
	"needs_household_registration": "需要遷戶籍",
	"needs_cooking":                "需要開伙",
	"needs_parking":                "需要停車位",
	"smoking":                      "是否抽菸",
	"occupation":                   "職業",
	"age":                          "年齡",
	"is_active":                    "啟用狀態",

	// listing
	"rent":                         "房租",
	"management_fee":               "管理費",
	"room_type":                    "房型",
	"area_ping":                    "坪數",
	"num_bedrooms":                 "房數",
	"num_living_rooms":             "廳數",
	"num_bathrooms":                "衛數",
	"num_balconies":                "陽台數",
	"allow_pets":                   "可否養寵物",
	"allow_subsidy":                "可否租屋補助",
	"allow_tax_receipt":            "可否開租賃稅單",
	"allow_household_registration": "可否遷戶籍",
	"allow_cooking":                "可否開伙",
	"has_parking":                  "停車位",
	"allow_smoking":                "可否抽菸",
	"compliance_confirmed":         "合規自我聲明",

	// reports
	"reported_id": "被檢舉對象",
	"listing_id":  "房源",
	"reason":      "原因",
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

