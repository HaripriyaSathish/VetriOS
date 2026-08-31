"""
Django settings for config project.
"""

from pathlib import Path
from decouple import config
import cloudinary

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*').split(',')


# Application definition
#
# NOTE: django.contrib.admin and sessions are deliberately NOT included —
# no admin panel (the React frontend is the real interface), no
# session-cookie auth (this is a JWT-only API). (Revisited and confirmed
# 2026-08-31; dev's d7dd7a0 re-added admin/sessions independently — kept
# out here per that earlier decision, worth syncing with Haripriya.)
#
# contenttypes + auth ARE included below, but only as a hard dependency of
# djangorestframework_simplejwt itself — its authentication.py imports
# django.contrib.auth.models, which requires contenttypes to resolve
# ContentType's app_label. This creates a small set of Django-owned
# tables (django_content_type, auth_permission, auth_group,
# auth_group_permissions) — notably NOT django_session or
# auth_user/auth_user_groups/auth_user_user_permissions, since we're not
# using sessions and AUTH_USER_MODEL is swapped to our own UserAccount.

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.staticfiles',

    'rest_framework',
    'corsheaders',
    'cloudinary_storage',
    'cloudinary',

    'module_01_identity_access',
    'module_02_hr',
    'module_03_training',
    'module_04_interns',
    'module_05_clients_projects',
    'module_06_documents',
    'module_07_email',
    'module_08_audit',
    'module_09_ai_rag',
    'local_extensions',
]

# Still needed even without admin: JWTAuthentication resolves the token's
# user via get_user_model(), which requires AUTH_USER_MODEL to point at
# our custom UserAccount instead of the (non-existent, since contrib.auth
# isn't installed) default auth.User.
AUTH_USER_MODEL = 'module_01_identity_access.UserAccount'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',        # must sit near the top, before CommonMiddleware
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CSRF/session middleware removed along with contrib.auth/sessions above.
# CSRF protection isn't needed here since this is a token-based (JWT) API,
# not a session-cookie-based Django app.

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database — VetriOSDB, connected as vetri_app_role (never postgres)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='VetriOSDB'),
        'USER': config('DB_USER', default='vetri_app_role'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        'OPTIONS': {
            'options': '-c search_path=django,public'
        },
    }
}

# Django REST Framework — JWT only, no session auth
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# simplejwt defaults to reading `user.id` — UserAccount's primary key
# attribute is `user_id` instead, so point it there explicitly.
SIMPLE_JWT = {
    'USER_ID_FIELD': 'user_id',
}


# CORS — allow the frontend dev server to call this API
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173'
).split(',')


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True


# Static & media files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Cloudinary — used as the default file storage for uploads
# (certificates, documents, attachments) instead of local disk
STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

CLOUDINARY_STORAGE = {
    'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': config('CLOUDINARY_API_KEY'),
    'API_SECRET': config('CLOUDINARY_API_SECRET'),
}

cloudinary.config(
    cloud_name=config('CLOUDINARY_CLOUD_NAME'),
    api_key=config('CLOUDINARY_API_KEY'),
    api_secret=config('CLOUDINARY_API_SECRET'),
    secure=True,
)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Email
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('EMAIL_HOST_USER', default='')