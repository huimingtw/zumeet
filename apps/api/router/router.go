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
	t := handler.NewContextTransformer()

	allowedOrigins := []string{"http://localhost:3000"}
	if cfg.AppEnv == "production" {
		allowedOrigins = []string{"https://app.zumeet.tw"}
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
		adminGroup.POST("/login", t.Public(h.AdminLogin))
		adminGroup.GET("/auth/callback", t.Public(h.AdminAuthCallback))
		adminGroup.POST("/logout", t.Public(h.AdminLogout))

		adminAuth := adminGroup.Group("")
		adminAuth.Use(middleware.AdminAuth([]byte(cfg.AdminJWTSecret), h.DB()))
		{
			adminAuth.GET("/reports", t.Public(h.AdminListReports))
			adminAuth.POST("/reports/:reportId/resolve", t.Public(h.AdminResolveReport))
			adminAuth.GET("/users/:userId", t.Public(h.AdminGetUser))
			adminAuth.POST("/users/:userId/suspend", t.Public(h.AdminSuspendUser))
			adminAuth.POST("/users/:userId/unsuspend", t.Public(h.AdminUnsuspendUser))
			adminAuth.POST("/users/:userId/delete", t.Public(h.AdminDeleteUser))
			adminAuth.POST("/listings/:listingId/remove", t.Public(h.AdminRemoveListing))
			adminAuth.POST("/listings/:listingId/restore", t.Public(h.AdminRestoreListing))
			adminAuth.GET("/actions", t.Public(h.AdminListActions))
		}
	}

	r.GET("/healthz", t.Public(h.HealthCheck))

	// Test-only routes: only mounted when ENABLE_TEST_ENDPOINTS=true.
	// main() guarantees this is never true when APP_ENV=production.
	if cfg.EnableTestEndpoints {
		r.POST("/test/oauth/google", t.Public(h.TestOAuthTokenEndpoint))
		r.GET("/test/oauth/userinfo", t.Public(h.TestOAuthUserInfoEndpoint))
		r.POST("/test/auth/seed", t.Public(h.TestSeedSession))
	}

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.GET("/google", t.Public(h.GoogleOAuthRedirect))
			auth.GET("/google/callback", t.Public(h.GoogleOAuthCallback))
			auth.POST("/onboarding", t.Public(h.Onboarding))
			auth.POST("/logout", t.Public(h.Logout))
			auth.POST("/refresh", t.Public(h.Refresh))
		}
	}

	// Protected routes — require valid access token
	protected := v1.Group("")
	protected.Use(middleware.Auth([]byte(cfg.JWTSecret), h.DB()))
	{
		tp := protected.Group("/tenant-profiles")
		{
			tp.GET("", t.Public(h.ListTenantProfiles))
			tp.POST("", t.Public(h.CreateTenantProfile))
			tp.GET("/:profileId", t.Public(h.GetTenantProfile))
			tp.PUT("/:profileId", t.Public(h.UpdateTenantProfile))
			tp.DELETE("/:profileId", t.Public(h.DeleteTenantProfile))
			tp.PATCH("/:profileId/status", t.Public(h.ToggleTenantProfileStatus))
		}

		ls := protected.Group("/listings")
		{
			ls.GET("", t.Public(h.ListLandlordListings))
			ls.POST("", t.Public(h.CreateListing))
			ls.GET("/:listingId", t.Public(h.GetListing))
			ls.PUT("/:listingId", t.Public(h.UpdateListing))
			ls.PATCH("/:listingId/status", t.Public(h.UpdateListingStatus))
			ls.DELETE("/:listingId", t.Public(h.DeleteListing))
			ls.POST("/:listingId/photos", t.Public(h.UploadListingPhoto))
			ls.PATCH("/:listingId/photos/order", t.Public(h.ReorderListingPhotos))
			ls.DELETE("/:listingId/photos/:photoId", t.Public(h.DeleteListingPhoto))
			ls.GET("/:listingId/tenant-profiles", t.Public(h.BrowseTenantProfilesForListing))
			ls.GET("/:listingId/viewing-availability", t.Public(h.GetViewingAvailability))
			ls.PUT("/:listingId/viewing-availability", t.Public(h.UpdateViewingAvailability))
			ls.GET("/:listingId/viewing-slots", t.Public(h.GetViewingSlots))
		}

		vw := protected.Group("/viewings")
		{
			vw.GET("", t.Public(h.ListViewings))
			vw.POST("", t.Public(h.BookViewing))
			vw.POST("/:viewingId/attendance", t.Public(h.SetViewingAttendance))
			vw.POST("/:viewingId/cancel", t.Public(h.CancelViewing))
			vw.POST("/:viewingId/reschedule", t.Public(h.RescheduleViewing))
		}

		tp.GET("/:profileId/listings", t.Public(h.BrowseListingsForProfile))
		tp.POST("/:profileId/listings/:listingId/interest", t.Public(h.ExpressInterestAsTenant))
		tp.GET("/:profileId/matches", t.Public(h.GetProfileMatches))
		tp.GET("/:profileId/interests/incoming", t.Public(h.GetProfileIncomingInterests))
		tp.GET("/:profileId/interests/outgoing", t.Public(h.GetProfileOutgoingInterests))

		ls.POST("/:listingId/tenant-profiles/:profileId/interest", t.Public(h.ExpressInterestAsLandlord))

		matches := protected.Group("/matches")
		{
			matches.GET("/mutual", t.Public(h.GetAllMutualMatches))
			matches.GET("/incoming", t.Public(h.GetAllIncomingInterests))
			matches.GET("/outgoing", t.Public(h.GetAllOutgoingInterests))
		}

		protected.GET("/profile/me", t.Public(h.GetMe))

		protected.POST("/reports", t.Public(h.CreateReport))
		protected.POST("/blocks/:userId", t.Public(h.BlockUser))
		protected.DELETE("/blocks/:userId", t.Public(h.UnblockUser))
		protected.DELETE("/account", t.Public(h.DeleteAccount))
	}

	return r
}
