package handler

import "strings"

func splitStringList(raw string) []string {
	if raw == "" {
		return []string{}
	}
	return strings.Split(raw, ",")
}
