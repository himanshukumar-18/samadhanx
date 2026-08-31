from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import OTPPurpose, UserRole


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: UserRole
    is_verified: bool
    is_approved: bool

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str

class OTPVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)
    purpose: OTPPurpose = OTPPurpose.REGISTRATION

class OTPResendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    purpose: OTPPurpose = OTPPurpose.REGISTRATION

class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)
