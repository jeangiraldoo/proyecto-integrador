from django.contrib import admin
from django.urls import include, path
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# add schema examples for token endpoints
TokenObtainPairView = extend_schema_view(
	post=extend_schema(
		summary="Obtain token pair",
		description="Obtain access and refresh JWT tokens using username/password.",
		request={"type": "object"},
		responses={200: {"type": "object"}},
		examples=[
			OpenApiExample(
				"Token request",
				value={"username": "juan", "password": "secret"},
				request_only=True,
			),
			OpenApiExample(
				"Token response",
				value={"access": "<jwt>", "refresh": "<jwt_refresh>"},
				response_only=True,
			),
		],
	)
)(TokenObtainPairView)

TokenRefreshView = extend_schema_view(
	post=extend_schema(
		summary="Refresh access token",
		description="Refresh an access token using a refresh token.",
		request={"type": "object"},
		responses={200: {"type": "object"}},
		examples=[
			OpenApiExample(
				"Refresh request",
				value={"refresh": "<jwt_refresh>"},
				request_only=True,
			),
			OpenApiExample(
				"Refresh response",
				value={"access": "<jwt>"},
				response_only=True,
			),
		],
	)
)(TokenRefreshView)

urlpatterns = [
	path("admin/", admin.site.urls),
	path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
	path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
	path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
	path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
	path("", include("planner.urls")),
]
