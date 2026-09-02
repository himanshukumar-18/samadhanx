import io
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.institution_master import InstitutionMaster, normalize_institution_name
from app.models.user import User
from app.services.institution_provider import InstitutionSyncService, UGCFileDatasetProvider


def test_institution_name_normalization():
    """Test normalization algorithm for institution names."""
    raw1 = "  Indian Institute of Technology, Delhi!  "
    raw2 = "indian   institute  of technology delhi"
    assert normalize_institution_name(raw1) == "indian institute of technology delhi"
    assert normalize_institution_name(raw2) == "indian institute of technology delhi"


@pytest.mark.asyncio
async def test_ugc_file_dataset_provider():
    """Test reading CSV dataset using UGCFileDatasetProvider."""
    csv_data = "name,state,district,aishe_code\nIIT Bombay,Maharashtra,Mumbai,C-1234\n"
    provider = UGCFileDatasetProvider(file_content=csv_data, file_type="csv")
    records = provider.fetch_records()
    assert len(records) == 1
    assert records[0]["name"] == "IIT Bombay"
    assert records[0]["state"] == "Maharashtra"


@pytest.mark.asyncio
async def test_institution_sync_service_upsert(db_session: AsyncSession):
    """Test safe upsert of institution dataset using InstitutionSyncService."""
    csv_data = (
        "name,state,district,aishe_code\n"
        "Delhi University,Delhi,New Delhi,U-0100\n"
        "Mumbai University,Maharashtra,Mumbai,U-0200\n"
    )
    provider = UGCFileDatasetProvider(file_content=csv_data, file_type="csv")
    service = InstitutionSyncService(db=db_session)
    sync_log = await service.sync_from_provider(provider=provider, source_name="test_sync")

    assert sync_log.records_processed == 2
    assert sync_log.records_added == 2
    assert sync_log.records_failed == 0

    # Re-sync with updated district for Mumbai University
    csv_data_updated = (
        "name,state,district,aishe_code\n"
        "Delhi University,Delhi,New Delhi,U-0100\n"
        "Mumbai University,Maharashtra,Mumbai Suburbs,U-0200\n"
    )
    provider2 = UGCFileDatasetProvider(file_content=csv_data_updated, file_type="csv")
    sync_log2 = await service.sync_from_provider(provider=provider2, source_name="test_sync_2")

    assert sync_log2.records_updated == 2
    assert sync_log2.records_added == 0


@pytest.mark.asyncio
async def test_public_institution_search_api(async_client: AsyncClient, db_session: AsyncSession):
    """Test GET /api/v1/public/institutions endpoint."""
    inst = InstitutionMaster(
        name="Indian Institute of Science",
        normalized_name=normalize_institution_name("Indian Institute of Science"),
        aishe_code="IISC-01",
        state="Karnataka",
        district="Bengaluru",
        verification_status="verified",
        is_active=True,
    )
    db_session.add(inst)
    await db_session.commit()

    response = await async_client.get("/api/v1/public/institutions?q=Science")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert len(res_json["data"]) >= 1
    item = res_json["data"][0]
    assert item["name"] == "Indian Institute of Science"
    assert item["state"] == "Karnataka"


@pytest.mark.asyncio
async def test_admin_csv_import_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Test POST /api/v1/admin/institutions/import-csv endpoint with Admin role."""
    admin_user = User(
        email="admin_inst@samadhanx.in",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(admin_user)
    await db_session.commit()

    token = create_access_token(str(admin_user.id), admin_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    csv_content = b"name,state,district,aishe_code\nNational Institute of Technology,Directorate,Rourkela,NIT-01\n"
    files = {"file": ("test_institutions.csv", io.BytesIO(csv_content), "text/csv")}

    response = await async_client.post("/api/v1/admin/institutions/import-csv", headers=headers, files=files)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["records_added"] == 1


@pytest.mark.asyncio
async def test_student_registration_with_institution_id(async_client: AsyncClient, db_session: AsyncSession):
    """Test registering a student innovator with a valid InstitutionMaster ID."""
    inst = InstitutionMaster(
        name="BIT Mesra",
        normalized_name=normalize_institution_name("BIT Mesra"),
        aishe_code="BIT-01",
        state="Jharkhand",
        district="Ranchi",
        verification_status="verified",
        is_active=True,
    )
    db_session.add(inst)
    await db_session.commit()

    payload = {
        "email": "student_bit@samadhanx.in",
        "password": "Password123!",
        "full_name": "Rajesh Sharma",
        "institution_id": str(inst.id),
        "department": "Computer Science",
        "graduation_year": 2026,
    }

    response = await async_client.post("/api/v1/auth/register/student", json=payload)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["email"] == "student_bit@samadhanx.in"
