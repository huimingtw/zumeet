package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// GeocodingService converts a human-readable address to (lat, lng).
type GeocodingService interface {
	Geocode(ctx context.Context, address string) (lat, lng float64, err error)
}

// ErrGeocodeNoResult is returned when the provider returned zero results.
var ErrGeocodeNoResult = errors.New("geocode: no result")

// GoogleGeocodingService calls Google Maps Geocoding API.
// Requires GOOGLE_MAPS_API_KEY.
type GoogleGeocodingService struct {
	apiKey string
	client *http.Client
}

func NewGoogleGeocodingService(apiKey string) *GoogleGeocodingService {
	return &GoogleGeocodingService{
		apiKey: apiKey,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *GoogleGeocodingService) Geocode(ctx context.Context, address string) (float64, float64, error) {
	if s.apiKey == "" {
		return 0, 0, errors.New("geocode: missing api key")
	}
	q := url.Values{}
	q.Set("address", address+", Taiwan")
	q.Set("key", s.apiKey)
	q.Set("language", "zh-TW")
	q.Set("region", "tw")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://maps.googleapis.com/maps/api/geocode/json?"+q.Encode(), nil)
	if err != nil {
		return 0, 0, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	var body struct {
		Status  string `json:"status"`
		Results []struct {
			Geometry struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
		} `json:"results"`
		ErrorMessage string `json:"error_message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return 0, 0, err
	}
	if body.Status == "ZERO_RESULTS" || len(body.Results) == 0 {
		return 0, 0, ErrGeocodeNoResult
	}
	if body.Status != "OK" {
		return 0, 0, fmt.Errorf("geocode: %s: %s", body.Status, body.ErrorMessage)
	}
	loc := body.Results[0].Geometry.Location
	return loc.Lat, loc.Lng, nil
}

// NoopGeocodingService is used when no API key is configured.
type NoopGeocodingService struct{}

func (NoopGeocodingService) Geocode(_ context.Context, _ string) (float64, float64, error) {
	return 0, 0, errors.New("geocode: disabled")
}
