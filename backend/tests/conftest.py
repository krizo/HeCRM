"""Pytest bootstrap — supply dummy Dataverse creds so `app.main` imports cleanly.

Tests that need to actually hit Dataverse should live under `tests/integration/`
and pull real values from a non-committed `.env.integration` file.
"""

import os

os.environ.setdefault("DATAVERSE_URL", "https://example-test.crm.dynamics.com")
os.environ.setdefault("AZURE_TENANT_ID", "test-tenant-id")
os.environ.setdefault("AZURE_CLIENT_ID", "test-client-id")
os.environ.setdefault("AZURE_CLIENT_SECRET", "test-client-secret")
