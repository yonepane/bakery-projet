import sys
sys.path.insert(0, '/home/dane/bakery-os/backend')

# Add the bakeryos_backend module to sys.modules
import sys
import os

# Create the bakeryos_backend module
import types
bakeryos_backend = types.ModuleType('bakeryos_backend')
bakeryos_backend.__path__ = ['/home/dane/bakery-os/backend']
sys.modules['bakeryos_backend'] = bakeryos_backend

# Now import the submodules
import routers
import services
import models

bakeryos_backend.routers = routers
bakeryos_backend.services = services
bakeryos_backend.models = models
bakeryos_backend.alembic = __import__('alembic')
bakeryos_backend.services = __import__('services')
bakeryos_backend.routers = __import__('routers')
bakeryos_backend.models = __import__('models')

sys.modules['bakeryos_backend'] = bakeryos_backend
sys.modules['bakeryos_backend.routers'] = bakeryos_backend.routers
sys.modules['bakeryos_backend.services'] = bakeryos_backend.services
sys.modules['bakeryos_backend.models'] = models
sys.modules['bakeryos_backend.alembic'] = bakeryos_backend.alembic
sys.modules['bakeryos_backend.services'] = bakeryos_backend.services
sys.modules['bakeryos_backend.routers'] = bakeryos_backend.routers
sys.modules['bakeryos_backend.models'] = models

print("bakeryos_backend module created")

# Now run pytest
import pytest
sys.exit(pytest.main(["-q"]))
