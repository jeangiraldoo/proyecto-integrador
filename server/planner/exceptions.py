import logging

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
	"""
	Global DRF exception handler.

	All errors follow:
	{
	  "errors": {
	    "field_or_resource": "message"
	  }
	}
	"""

	response = exception_handler(exc, context)

	if isinstance(exc, ValidationError):
		detail = exc.detail

		if isinstance(detail, dict) and "errors" in detail:
			return Response(
				detail,
				status=status.HTTP_422_UNPROCESSABLE_ENTITY,
			)

		errors = {}
		if isinstance(detail, dict):
			for field, messages in detail.items():
				if isinstance(messages, list):
					errors[field] = messages[0]
				else:
					errors[field] = str(messages)
		else:
			errors["detail"] = str(detail)

		return Response(
			{"errors": errors},
			status=status.HTTP_422_UNPROCESSABLE_ENTITY,
		)

	if isinstance(exc, (Http404, NotFound)):
		message = (
			exc.detail
			if hasattr(exc, "detail") and exc.detail
			else "Requested resource was not found"
		)

		return Response(
			{"errors": {"resource": message}},
			status=status.HTTP_404_NOT_FOUND,
		)

	if response is None:
		logger.exception("Unhandled exception", exc_info=exc)
		return Response(
			{"errors": {"server": "Internal server error"}},
			status=status.HTTP_500_INTERNAL_SERVER_ERROR,
		)

	if isinstance(response.data, dict) and "detail" in response.data:
		return Response(
			{"errors": {"detail": response.data["detail"]}},
			status=response.status_code,
		)

	return response
