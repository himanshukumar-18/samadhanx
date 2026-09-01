import uuid

from fastapi import HTTPException, status

from app.core.config import settings


class CloudinaryService:
    """Cloudinary-only media storage."""

    @staticmethod
    async def upload_media(
        file_content: bytes, filename: str, content_type: str | None, folder: str = "samadhanx"
    ) -> dict[str, str]:
        if not settings.CLOUDINARY_URL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "MEDIA_STORAGE_UNAVAILABLE", "message": "Cloudinary is not configured."},
            )

        if not content_type or not (content_type.startswith("image/") or content_type.startswith("video/")):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "Only image and video files are supported."},
            )

        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)
            resource_type = "video" if content_type.startswith("video/") else "image"
            response = cloudinary.uploader.upload(
                file_content,
                folder=folder,
                public_id=f"{folder}_{uuid.uuid4().hex[:12]}",
                resource_type=resource_type,
                use_filename=False,
                unique_filename=True,
            )
            secure_url = response.get("secure_url")
            public_id = response.get("public_id")
            if not secure_url or not public_id:
                raise ValueError("Cloudinary did not return a media identifier")
            return {"url": secure_url, "public_id": public_id, "resource_type": resource_type}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "MEDIA_UPLOAD_FAILED", "message": "Cloudinary could not upload the media."},
            ) from exc

    @staticmethod
    async def upload_image(file_content: bytes, filename: str, folder: str = "samadhanx") -> str:
        result = await CloudinaryService.upload_media(file_content, filename, "image/jpeg", folder)
        return result["url"]
