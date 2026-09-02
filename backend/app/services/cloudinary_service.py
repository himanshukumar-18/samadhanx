import base64
import io
import logging
import uuid

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudinaryService:
    """Cloudinary media storage with automatic fallback."""

    @staticmethod
    async def upload_media(
        file_content: bytes, filename: str, content_type: str | None, folder: str = "samadhanx"
    ) -> dict[str, str]:
        if not content_type or not (content_type.startswith("image/") or content_type.startswith("video/")):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "Only image and video files are supported."},
            )

        cloudinary_url = settings.CLOUDINARY_URL
        if cloudinary_url:
            # Strip accidental angle brackets <key>:<secret> if formatted with placeholders
            cloudinary_url = cloudinary_url.replace("<", "").replace(">", "").strip()

        if cloudinary_url and "cloudinary://" in cloudinary_url:
            try:
                import cloudinary
                import cloudinary.uploader

                cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
                resource_type = "video" if content_type.startswith("video/") else "image"
                
                # Wrap bytes in io.BytesIO so Cloudinary uploader reads the stream properly
                file_stream = io.BytesIO(file_content)
                response = cloudinary.uploader.upload(
                    file_stream,
                    folder=folder,
                    public_id=f"{folder}_{uuid.uuid4().hex[:12]}",
                    resource_type=resource_type,
                    use_filename=False,
                    unique_filename=True,
                )
                secure_url = response.get("secure_url")
                public_id = response.get("public_id")
                if secure_url and public_id:
                    logger.info(f"Successfully uploaded media to Cloudinary: {secure_url}")
                    return {"url": secure_url, "public_id": public_id, "resource_type": resource_type}
            except Exception as exc:
                logger.error(f"Cloudinary upload error: {exc}", exc_info=True)

        # Resilient fallback to data URI if Cloudinary credentials or network fail
        encoded = base64.b64encode(file_content).decode("utf-8")
        mime = content_type or "image/jpeg"
        data_url = f"data:{mime};base64,{encoded}"
        public_id = f"local_{uuid.uuid4().hex[:12]}"
        resource_type = "video" if mime.startswith("video/") else "image"
        return {"url": data_url, "public_id": public_id, "resource_type": resource_type}

    @staticmethod
    async def upload_image(file_content: bytes, filename: str, folder: str = "samadhanx") -> str:
        result = await CloudinaryService.upload_media(file_content, filename, "image/jpeg", folder)
        return result["url"]
