package router

import (
	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/middleware"
)

func New(h *handler.Handler, cfg *config.AppConfig) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/healthz", h.HealthCheck)

	// Test-only: mock Google OAuth token + userinfo endpoints.
	// Guard ensures these routes are NEVER mounted in production.
	if cfg.AppEnv == "test" {
		r.POST("/test/oauth/google", h.TestOAuthTokenEndpoint)
		r.GET("/test/oauth/userinfo", h.TestOAuthUserInfoEndpoint)
	}

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.GET("/google", h.GoogleOAuthRedirect)
			auth.GET("/google/callback", h.GoogleOAuthCallback)
			auth.POST("/onboarding", h.Onboarding)
			auth.POST("/logout", h.Logout)
			auth.POST("/refresh", h.Refresh)
		}
	}

	// Protected routes — require valid access token
	protected := v1.Group("")
	protected.Use(middleware.Auth([]byte(cfg.JWTSecret), h.DB()))
	{
		tp := protected.Group("/tenant-profiles")
		{
			tp.GET("", h.ListTenantProfiles)
			tp.POST("", h.CreateTenantProfile)
			tp.GET("/:profileId", h.GetTenantProfile)
			tp.PUT("/:profileId", h.UpdateTenantProfile)
			tp.DELETE("/:profileId", h.DeleteTenantProfile)
			tp.PATCH("/:profileId/status", h.ToggleTenantProfileStatus)
		}

		ls := protected.Group("/listings")
		{
			ls.GET("", h.ListLandlordListings)
			ls.POST("", h.CreateListing)
			ls.GET("/:listingId", h.GetListing)
			ls.PUT("/:listingId", h.UpdateListing)
			ls.PATCH("/:listingId/status", h.UpdateListingStatus)
			ls.DELETE("/:listingId", h.DeleteListing)
			ls.POST("/:listingId/photos", h.UploadListingPhoto)
			ls.DELETE("/:listingId/photos/:photoId", h.DeleteListingPhoto)
			ls.GET("/:listingId/tenant-profiles", h.BrowseTenantProfilesForListing)
		}

		tp.GET("/:profileId/listings", h.BrowseListingsForProfile)
		tp.POST("/:profileId/listings/:listingId/interest", h.ExpressInterestAsTenant)
		tp.GET("/:profileId/matches", h.GetProfileMatches)
		tp.GET("/:profileId/interests/incoming", h.GetProfileIncomingInterests)
		tp.GET("/:profileId/interests/outgoing", h.GetProfileOutgoingInterests)

		ls.POST("/:listingId/tenant-profiles/:profileId/interest", h.ExpressInterestAsLandlord)

		matches := protected.Group("/matches")
		{
			matches.GET("/mutual", h.GetAllMutualMatches)
			matches.GET("/incoming", h.GetAllIncomingInterests)
			matches.GET("/outgoing", h.GetAllOutgoingInterests)
		}

		protected.GET("/profile/me", h.GetMe)

		protected.POST("/reports", h.CreateReport)
		protected.POST("/blocks/:userId", h.BlockUser)
		protected.DELETE("/blocks/:userId", h.UnblockUser)
		protected.DELETE("/account", h.DeleteAccount)
	}

	return r
}
