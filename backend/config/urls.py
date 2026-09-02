"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import include, path

# django.contrib.admin is not installed (see settings.py) — login is fully
# custom against user_account/role/user_role, so there's no admin/ route.
# Module URLs get included here as each module builds out its API.

urlpatterns = [
    path('api/identity/', include('module_01_identity_access.urls')),
    path('api/training/', include('module_03_training.urls')),
]
