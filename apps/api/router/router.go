package router

import (
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/middleware"
)

func New(h *handler.Handler, cfg *config.AppConfig, logger *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(logger))

	// Admin subdomain routes (admin.zumeet.tw)
	// In tests / local dev, mount under /admin prefix as well
	adminGroup := r.Group("")
	if cfg.AppEnv == "test" || cfg.AppEnv == "development" {
		adminGroup = r.Group("/admin")
	}
	{
		adminGroup.POST("/login", h.AdminLogin)
		adminGroup.GET("/auth/callback", h.AdminAuthCallback)
		adminGroup.POST("/logout", h.AdminLogout)

		adminAuth := adminGroup.Group("")
		adminAuth.Use(middleware.AdminAuth([]byte(cfg.AdminJWTSecret), h.DB()))
		{
			adminAuth.GET("/reports", h.AdminListReports)
			adminAuth.POST("/reports/:reportId/resolve", h.AdminResolveReport)
			adminAuth.GET("/users/:userId", h.AdminGetUser)
			adminAuth.POST("/users/:userId/suspend", h.AdminSuspendUser)
			adminAuth.POST("/users/:userId/unsuspend", h.AdminUnsuspendUser)
			adminAuth.POST("/users/:userId/delete", h.AdminDeleteUser)
			adminAuth.POST("/listings/:listingId/remove", h.AdminRemoveListing)
			adminAuth.POST("/listings/:listingId/restore", h.AdminRestoreListing)
			adminAuth.GET("/actions", h.AdminListActions)
		}
	}

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
