import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('module_05_clients_projects', '0004_taskassignee_review_status'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectMessage',
            fields=[
                ('project_message_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(db_column='project_id', db_constraint=False, on_delete=django.db.models.deletion.CASCADE, related_name='group_messages', to='module_05_clients_projects.project')),
                ('sender', models.ForeignKey(db_column='sender_user_id', db_constraint=False, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='project_group_messages', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'ext_project_message',
                'ordering': ['created_at'],
                'indexes': [models.Index(fields=['project', 'created_at'], name='ext_projmsg_proj_created_idx')],
            },
        ),
    ]
