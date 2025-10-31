"""
Unit tests for the SisuClient HTTP client

Tests cover basic client functionality including successful requests,
error handling, and timeout scenarios.
"""

# test_client.py is minimal - consider expanding:
# - Test service layer logic
# - Test model properties and methods
# - Mock more edge cases (404s, malformed JSON, etc.)
# - Integration tests with fixtures

from unittest.mock import Mock, patch
import pytest
import requests
from sisu_wrapper import SisuClient, SisuAPIError


def test_client_initialization():
    """Test that SisuClient initializes with correct timeout and base URL"""

    client = SisuClient(timeout=20)
    assert client.timeout == 20
    assert client.base_url == SisuClient.BASE_URL


@patch('requests.Session.get')
def test_fetch_course_unit_success(mock_get):
    """Test that successful course unit fetch returns expected data"""
    mock_response = Mock()
    mock_response.json.return_value = {"name": {"en": "Test Course"}}
    mock_response.status_code = 200
    mock_get.return_value = mock_response

    client = SisuClient()
    result = client.fetch_course_unit("test-id")

    assert result["name"]["en"] == "Test Course"


@patch('requests.Session.get')
def test_fetch_course_unit_timeout(mock_get):
    """
    Test that timeout errors are properly caught
    and raised as SisuAPIError
    """

    mock_get.side_effect = requests.Timeout()

    client = SisuClient()
    with pytest.raises(SisuAPIError):
        client.fetch_course_unit("test-id")
