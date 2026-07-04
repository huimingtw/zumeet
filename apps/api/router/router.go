package router

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/zumeet/api/config"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/middleware"
)

func New(h *handler.Handler, cfg *config.AppConfig, logger *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(logger))
	t := handler.NewContextTransformer(logger)

	allowedOrigins := []string{"http://localhost:3000", "http://localhost:3001"}
	if cfg.AppEnv == "production" {
		allowedOrigins = []string{"https://app.zumeet.tw", "https://admin.zumeet.tw"}
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Admin subdomain routes (admin.zumeet.tw)
	// In tests / local dev, mount under /admin prefix as well
	adminGroup := r.Group("")
	if cfg.AppEnv == "test" || cfg.AppEnv == "development" {
		adminGroup = r.Group("/admin")
	}
	{
		adminGroup.POST("/login", t.WithAppContext(h.AdminLogin))
		adminGroup.GET("/auth/callback", t.WithAppContext(h.AdminAuthCallback))
		adminGroup.POST("/logout", t.WithAppContext(h.AdminLogout))

		adminAuth := adminGroup.Group("")
		adminAuth.Use(middleware.AdminAuth([]byte(cfg.AdminJWTSecret), h.DB()))
		{
			adminAuth.GET("/reports", t.WithAppContext(h.AdminListReports))
			adminAuth.POST("/reports/:reportId/resolve", t.WithAppContext(h.AdminResolveReport))
			adminAuth.GET("/users/:userId", t.WithAppContext(h.AdminGetUser))
			adminAuth.POST("/users/:userId/suspend", t.WithAppContext(h.AdminSuspendUser))
			adminAuth.POST("/users/:userId/unsuspend", t.WithAppContext(h.AdminUnsuspendUser))
			adminAuth.POST("/users/:userId/delete", t.WithAppContext(h.AdminDeleteUser))
			adminAuth.POST("/listings/:listingId/remove", t.WithAppContext(h.AdminRemoveListing))
			adminAuth.POST("/listings/:listingId/restore", t.WithAppContext(h.AdminRestoreListing))
			adminAuth.GET("/actions", t.WithAppContext(h.AdminListActions))
		}
	}

	r.GET("/healthz", t.WithAppContext(h.HealthCheck))

	// Test-only routes: only mounted when ENABLE_TEST_ENDPOINTS=true.
	// main() guarantees this is never true when APP_ENV=production.
	if cfg.EnableTestEndpoints {
		r.POST("/test/oauth/google", t.WithAppContext(h.TestOAuthTokenEndpoint))
		r.GET("/test/oauth/userinfo", t.WithAppContext(h.TestOAuthUserInfoEndpoint))
		r.POST("/test/auth/seed", t.WithAppContext(h.TestSeedSession))
	}

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.GET("/google", t.WithAppContext(h.GoogleOAuthRedirect))
			auth.GET("/google/callback", t.WithAppContext(h.GoogleOAuthCallback))
			auth.POST("/onboarding", t.WithAppContext(h.Onboarding))
			auth.POST("/logout", t.WithAppContext(h.Logout))
			auth.POST("/refresh", t.WithAppContext(h.Refresh))
		}
	}

	// Protected routes — require valid access token
	protected := v1.Group("")
	protected.Use(middleware.Auth([]byte(cfg.JWTSecret), h.DB()))
	{
		tp := protected.Group("/tenant-profiles")
		{
			tp.GET("", t.WithAppContext(h.ListTenantProfiles))
			tp.POST("", t.WithAppContext(h.CreateTenantProfile))
			tp.GET("/:profileId", t.WithAppContext(h.GetTenantProfile))
			tp.PUT("/:profileId", t.WithAppContext(h.UpdateTenantProfile))
			tp.DELETE("/:profileId", t.WithAppContext(h.DeleteTenantProfile))
			tp.PATCH("/:profileId/status", t.WithAppContext(h.ToggleTenantProfileStatus))
		}

		ls := protected.Group("/listings")
		{
			ls.GET("", t.WithAppContext(h.ListLandlordListings))
			ls.POST("", t.WithAppContext(h.CreateListing))
			ls.GET("/:listingId", t.WithAppContext(h.GetListing))
			ls.PUT("/:listingId", t.WithAppContext(h.UpdateListing))
			ls.PATCH("/:listingId/status", t.WithAppContext(h.UpdateListingStatus))
			ls.DELETE("/:listingId", t.WithAppContext(h.DeleteListing))
			ls.POST("/:listingId/photos", t.WithAppContext(h.UploadListingPhoto))
			ls.PATCH("/:listingId/photos/order", t.WithAppContext(h.ReorderListingPhotos))
			ls.DELETE("/:listingId/photos/:photoId", t.WithAppContext(h.DeleteListingPhoto))
			ls.GET("/:listingId/tenant-profiles", t.WithAppContext(h.BrowseTenantProfilesForListing))
			ls.GET("/:listingId/viewing-availability", t.WithAppContext(h.GetViewingAvailability))
			ls.PUT("/:listingId/viewing-availability", t.WithAppContext(h.UpdateViewingAvailability))
			ls.GET("/:listingId/viewing-slots", t.WithAppContext(h.GetViewingSlots))
		}

		vw := protected.Group("/viewings")
		{
			vw.GET("", t.WithAppContext(h.ListViewings))
			vw.POST("", t.WithAppContext(h.BookViewing))
			vw.POST("/:viewingId/attendance", t.WithAppContext(h.SetViewingAttendance))
			vw.POST("/:viewingId/cancel", t.WithAppContext(h.CancelViewing))
			vw.POST("/:viewingId/reschedule", t.WithAppContext(h.RescheduleViewing))
		}

		tp.GET("/:profileId/listings", t.WithAppContext(h.BrowseListingsForProfile))
		tp.POST("/:profileId/listings/:listingId/interest", t.WithAppContext(h.ExpressInterestAsTenant))
		tp.DELETE("/:profileId/listings/:listingId/interest", t.WithAppContext(h.WithdrawInterestAsTenant))
		tp.GET("/:profileId/matches", t.WithAppContext(h.GetProfileMatches))
		tp.GET("/:profileId/interests/incoming", t.WithAppContext(h.GetProfileIncomingInterests))
		tp.GET("/:profileId/interests/outgoing", t.WithAppContext(h.GetProfileOutgoingInterests))

		ls.POST("/:listingId/tenant-profiles/:profileId/interest", t.WithAppContext(h.ExpressInterestAsLandlord))
		ls.DELETE("/:listingId/tenant-profiles/:profileId/interest", t.WithAppContext(h.WithdrawInterestAsLandlord))

		matches := protected.Group("/matches")
		{
			matches.GET("/mutual", t.WithAppContext(h.GetAllMutualMatches))
			matches.GET("/incoming", t.WithAppContext(h.GetAllIncomingInterests))
			matches.GET("/outgoing", t.WithAppContext(h.GetAllOutgoingInterests))
		}

		protected.GET("/profile/me", t.WithAppContext(h.GetMe))
		protected.PUT("/profile/me", t.WithAppContext(h.UpdateMe))

		protected.POST("/reports", t.WithAppContext(h.CreateReport))
		protected.POST("/blocks/:userId", t.WithAppContext(h.BlockUser))
		protected.DELETE("/blocks/:userId", t.WithAppContext(h.UnblockUser))
		protected.DELETE("/account", t.WithAppContext(h.DeleteAccount))
	}

	return r
}
