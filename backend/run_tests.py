#!/usr/bin/env python3
"""Test runner with proper module setup."""

import sys
import os
import types

# Add backend to path
sys.path.insert(0, '/home/dane/bakery-os/backend')

# Create bakeryos_backend module
bakeryos_backend = type(sys)('bakeryos_backend')
bakeryos_backend.__path__ = ['/home/dane/bakery-os/backend']

# Import all modules
import routers
import services
import models

# Create bakeryos_backend module
bakeryos_backend = type(sys)('bakeryos_backend')
bakeryos_backend.__path__ = ['/home/dane/bakery-os/backend']

# Import all modules
import routers
import services
import models
import alembic
import auth
import database
import schemas

# Register bakeryos_backend module
import sys
bakeryos_backend = type(sys)('bakeryos_backend')
bakeryos_backend.__path__ = ['/home/dane/bakery-os/backend']

# Import all modules and attach to bakeryos_backend
import routers
import services
import models
import alembic
import auth
import database
import schemas

bakeryos_backend.routers = __import__('routers')
bakeryos_backend.services = __import__('services')
bakeryos_backend.models = __import__('models')
bakeryos_backend.alembic = __import__('alembic')
bakeryos_backend.auth = __import__('auth')
bakeryos_backend.database = __import__('database')
bakeryos_backend.schemas = __import__('schemas')

# Register in sys.modules
sys.modules['bakeryos_backend'] = sys.modules['__main__']
sys.modules['bakeryos_backend.routers'] = bakeryos_backend.routers
sys.modules['bakeryos_backend.services'] = bakeryos_backend.services
sys.modules['bakeryos_backend.models'] = __import__('models')
sys.modules['bakeryos_backend.alembic'] = __import__('alembic')

# Import all router modules
import routers.auth as auth_module
import routers.catalog as catalog_module
import routers.finance as finance_module
import routers.intelligence as intelligence_module
import routers.kitchen as kitchen_module
import routers.operations as operations_module
import routers.orders as orders_module
import routers.pos as pos_module
import routers.purchasing as purchasing_module
import routers.reports as reports_module
import routers.shift_logs as shift_logs_module
import routers.staff as staff_module
import routers.currency as currency_module
import routers.customers as customers_module
import routers.semi_finished as semi_finished_module
import routers.kitchen as kitchen_module
import routers.operations as operations_module
import routers.orders as orders_module
import routers.pos as pos_module
import routers.purchasing as purchasing_module
import routers.reports as reports_module
import routers.shift_logs as shift_logs_module
import routers.staff as staff_module
import routers.currency as currency_module
import routers.customers as customers_module
import routers.semi_finished as semi_finished_module
import routers.kitchen as kitchen_module
import routers.operations as operations_module
import routers.orders as orders_module
import routers.pos as pos_module
import routers.purchasing as purchasing_module
import routers.reports as reports_module
import routers.shift_logs as shift_logs_module
import routers.staff as staff_module
import routers.currency as currency_module
import routers.customers as customers_module
import routers.semi_finished as semi_finished_module

# Add to bakeryos_backend.routers
import sys
sys.modules['bakeryos_backend.routers'] = sys.modules['__main__']
bakeryos_backend = sys.modules['__main__']
bakeryos_backend.routers = __import__('routers')
bakeryos_backend.services = __import__('services')
bakeryos_backend.models = __import__('models')
bakeryos_backend.alembic = __import__('alembic')

# Add submodules
bakeryos_backend.routers.auth = __import__('routers.auth')
bakeryos_backend.routers.catalog = __import__('routers.catalog')
bakeryos_backend.routers.finance = __import__('routers.finance')
bakeryos_backend.routers.intelligence = __import__('routers.intelligence')
bakeryos_backend.routers.kitchen = __import__('routers.kitchen')
bakeryos_backend.routers.operations = __import__('routers.operations')
bakeryos_backend.routers.orders = __import__('routers.orders')
bakeryos_backend.routers.pos = __import__('routers.pos')
bakeryos_backend.routers.purchasing = __import__('routers.purchasing')
bakeryos_backend.routers.reports = __import__('routers.reports')
bakeryos_backend.routers.shift_logs = __import__('routers.shift_logs')
bakeryos_backend.routers.staff = __import__('routers.staff')
bakeryos_backend.routers.currency = __import__('routers.currency')
bakeryos_backend.routers.customers = __import__('routers.customers')
bakeryos_backend.routers.semi_finished = __import__('routers.semi_finished')
bakeryos_backend.routers.kitchen = __import__('routers.kitchen')
bakeryos_backend.routers.operations = __import__('routers.operations')
bakeryos_backend.routers.orders = __import__('routers.orders')
bakeryos_backend.routers.pos = __import__('routers.pos')
bakeryos_backend.routers.purchasing = __import__('routers.purchasing')
bakeryos_backend.routers.reports = __import__('routers.reports')
bakeryos_backend.routers.shift_logs = __import__('routers.shift_logs')
bakeryos_backend.routers.staff = __import__('routers.staff')
bakeryos_backend.routers.currency = __import__('routers.currency')
bakeryos_backend.routers.customers = __import__('routers.customers')
bakeryos_backend.routers.semi_finished = __import__('routers.semi_finished')
bakeryos_backend.routers.kitchen = __import__('routers.kitchen')
bakeryos_backend.routers.operations = __import__('routers.operations')
bakeryos_backend.routers.orders = __import__('routers.orders')
bakeryos_backend.routers.pos = __import__('routers.pos')
bakeryos_backend.routers.purchasing = __import__('routers.purchasing')
bakeryos_backend.routers.reports = __import__('routers.reports')
bakeryos_backend.routers.shift_logs = __import__('routers.shift_logs')
bakeryos_backend.routers.staff = __import__('routers.staff')
bakeryos_backend.routers.currency = __import__('routers.currency')
bakeryos_backend.routers.customers = __import__('routers.customers')
bakeryos_backend.routers.semi_finished = __import__('routers.semi_finished')
bakeryos_backend.routers.kitchen = __import__('routers.kitchen')
bakeryos_backend.routers.operations = __import__('routers.operations')
bakeryos_backend.routers.orders = __import__('routers.orders')
bakeryos_backend.routers.pos = __import__('routers.pos')
bakeryos_backend.routers.purchasing = __import__('routers.purchasing')
bakeryos_backend.routers.reports = __import__('routers.reports')
bakeryos_backend.routers.shift_logs = __import__('routers.shift_logs')
bakeryos_backend.routers.staff = __import__('routers.staff')
bakeryos_backend.routers.currency = __import__('routers.currency')
bakeryos_backend.routers.customers = __import__('routers.customers')
bakeryos_backend.routers.semi_finished = __import__('routers.semi_finished')

# Also add services
bakeryos_backend.services.stock = __import__('services.stock')
bakeryos_backend.services.locations = __import__('services.locations')
bakeryos_backend.services.financial_events = __import__('services.financial_events')

# Register in sys.modules
import sys
sys.modules['bakeryos_backend'] = sys.modules['__main__']
sys.modules['bakeryos_backend.routers'] = sys.modules['__main__'].bakeryos_backend.routers
sys.modules['bakeryos_backend.services'] = sys.modules['__main__'].bakeryos_backend.services
sys.modules['bakeryos_backend.models'] = __import__('models')
sys.modules['bakeryos_backend.alembic'] = __import__('alembic')
sys.modules['bakeryos_backend.auth'] = __import__('auth')
sys.modules['bakeryos_backend.database'] = __import__('database')
sys.modules['bakeryos_backend.schemas'] = __import__('schemas')

# Now import pytest and run
import pytest
import sys
sys.exit(pytest.main(['-q', 'backend/tests/'] + sys.argv[1:]))