"""J18d : section ou groupement du membre dans l'organisation. Ajout seulement."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("actors", "0002_identifiant_producteur_et_menage"),
    ]

    operations = [
        migrations.AddField(
            model_name="producerorganizationassignment",
            name="section",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Section, groupement ou village de rattachement dans l'organisation.",
                max_length=100,
            ),
        ),
    ]
