from pydantic import BaseModel, ConfigDict


class AccountSettingsUpdate(BaseModel):
    email_notifications: bool | None = None
    push_notifications: bool | None = None
    public_profile: bool | None = None
    show_contact: bool | None = None


class AccountSettingsResponse(BaseModel):
    email_notifications: bool
    push_notifications: bool
    public_profile: bool
    show_contact: bool

    model_config = ConfigDict(from_attributes=True)
