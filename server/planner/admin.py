from django.contrib import admin
from .models import (
    User,
    Activity,
    Subtask,
    Progress,
    Conflict,
    ConflictResolution,
)

admin.site.register(User)
admin.site.register(Activity)
admin.site.register(Subtask)
admin.site.register(Progress)
admin.site.register(Conflict)
admin.site.register(ConflictResolution)
