const en = {
  // app & navigation
  'app.name': 'AURIX',
  'app.tagline': 'Retail Operating System',
  'nav.dashboard': 'Dashboard', 'nav.pos': 'Point of Sale', 'nav.products': 'Products', 'nav.categories': 'Categories', 'nav.suppliers': 'Suppliers',
  'nav.purchases': 'Purchases', 'nav.inventory': 'Inventory', 'nav.alerts': 'Stock Alerts', 'nav.movements': 'Stock Movements', 'nav.counts': 'Stock Count',
  'nav.sales': 'Sales & Invoices', 'nav.returns': 'Returns', 'nav.expenses': 'Expenses', 'nav.shifts': 'Cashier Shifts', 'nav.reports': 'Reports',
  'nav.users': 'Users', 'nav.audit': 'Audit Log', 'nav.settings': 'Settings', 'nav.sync': 'Google Sheets',
  'nav.group.sell': 'Sell', 'nav.group.stock': 'Stock', 'nav.group.money': 'Money', 'nav.group.admin': 'Administration',
  'nav.logout': 'Sign out', 'nav.changePassword': 'Change password', 'nav.language': 'العربية', 'nav.menu': 'Menu',

  // common
  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.edit': 'Edit', 'common.add': 'Add', 'common.create': 'Create',
  'common.search': 'Search', 'common.filter': 'Filter', 'common.all': 'All', 'common.yes': 'Yes', 'common.no': 'No', 'common.confirm': 'Confirm',
  'common.back': 'Back', 'common.loading': 'Loading…', 'common.saving': 'Saving…', 'common.retry': 'Retry', 'common.export': 'Export CSV', 'common.print': 'Print',
  'common.actions': 'Actions', 'common.details': 'Details', 'common.view': 'View', 'common.status': 'Status', 'common.date': 'Date', 'common.time': 'Time',
  'common.notes': 'Notes', 'common.reason': 'Reason', 'common.total': 'Total', 'common.amount': 'Amount', 'common.qty': 'Qty', 'common.user': 'User',
  'common.name': 'Name', 'common.active': 'Active', 'common.archived': 'Archived', 'common.inactive': 'Inactive', 'common.from': 'From', 'common.to': 'To',
  'common.noResults': 'No results found', 'common.empty': 'Nothing here yet', 'common.prev': 'Previous', 'common.next': 'Next', 'common.of': 'of',
  'common.optional': 'optional', 'common.required': 'Required', 'common.saved': 'Saved successfully', 'common.error': 'Something went wrong',
  'common.reference': 'Reference', 'common.description': 'Description', 'common.category': 'Category', 'common.method': 'Method', 'common.type': 'Type',
  'common.phone': 'Phone', 'common.email': 'Email', 'common.archive': 'Archive', 'common.restore': 'Restore', 'common.refresh': 'Refresh',
  'common.showing': 'Showing {n} of {total}', 'common.egp': 'EGP', 'common.items': '{n} items', 'common.units': 'units', 'common.none': '—',
  'common.offline': 'You are offline. Changes cannot be saved until the connection returns.', 'common.permissionDenied': 'You do not have permission for this action.',

  // ranges
  'range.today': 'Today', 'range.yesterday': 'Yesterday', 'range.week': 'This week', 'range.month': 'This month', 'range.last30': 'Last 30 days',
  'range.year': 'This year', 'range.custom': 'Custom range', 'range.apply': 'Apply',

  // auth
  'auth.title': 'Welcome back', 'auth.subtitle': 'Sign in to the AURIX store system', 'auth.username': 'Username', 'auth.password': 'Password',
  'auth.signIn': 'Sign in', 'auth.signingIn': 'Signing in…', 'auth.changeTitle': 'Set a new password', 'auth.changeSubtitle': 'For security, choose a new password before continuing.',
  'auth.current': 'Current password', 'auth.new': 'New password', 'auth.confirmNew': 'Confirm new password', 'auth.mismatch': 'Passwords do not match',
  'auth.hero1': 'Accessories.', 'auth.hero2': 'Fragrance. Beauty.',
  'auth.rules': 'At least 8 characters, including a letter and a digit.', 'auth.changed': 'Password changed',

  // dashboard
  'dash.title': 'Dashboard', 'dash.greeting': 'Good to see you, {name}', 'dash.gross': 'Gross sales', 'dash.net': 'Net sales', 'dash.netHint': 'after returns',
  'dash.invoices': 'Invoices', 'dash.avgTicket': 'Average sale', 'dash.grossProfit': 'Gross profit', 'dash.margin': '{pct}% margin', 'dash.netProfit': 'Net profit',
  'dash.netProfitHint': 'after expenses', 'dash.expenses': 'Expenses', 'dash.refunds': 'Refunds', 'dash.discounts': 'Discounts', 'dash.products': 'Products',
  'dash.unitsInStock': 'Units in stock', 'dash.lowStock': 'Low stock', 'dash.outOfStock': 'Out of stock', 'dash.stockValue': 'Stock value (cost)',
  'dash.retailValue': 'Retail value', 'dash.bestSellers': 'Best sellers', 'dash.recentSales': 'Recent sales', 'dash.byMethod': 'Sales by payment method',
  'dash.byCashier': 'Sales by cashier', 'dash.daily': 'Daily sales', 'dash.monthly': 'Monthly performance', 'dash.openAlerts': 'Open stock alerts',
  'dash.cogs': 'Cost of goods sold', 'dash.viewAll': 'View all', 'dash.noSales': 'No sales in this period yet',

  // POS
  'pos.title': 'Point of Sale', 'pos.search': 'Search name, SKU or scan barcode…', 'pos.allCategories': 'All', 'pos.cart': 'Current sale', 'pos.emptyCart': 'Scan or tap a product to start a sale',
  'pos.subtotal': 'Subtotal', 'pos.discount': 'Discount', 'pos.lineDiscount': 'Item discount', 'pos.orderDiscount': 'Order discount', 'pos.total': 'Total',
  'pos.received': 'Amount received', 'pos.change': 'Change due', 'pos.pay': 'Charge', 'pos.clear': 'Clear', 'pos.clearConfirm': 'Remove all items from this sale?',
  'pos.inStock': '{n} in stock', 'pos.outOfStock': 'Out of stock', 'pos.lowStock': 'Only {n} left', 'pos.maxStock': 'Only {n} available', 'pos.added': 'Added {name}',
  'pos.notFound': 'No product matches “{code}”', 'pos.checkout': 'Checkout', 'pos.paymentMethod': 'Payment method', 'pos.split': 'Split payment',
  'pos.addPayment': 'Add payment', 'pos.remaining': 'Remaining', 'pos.exact': 'Exact', 'pos.confirmPayment': 'Confirm payment & complete sale',
  'pos.processing': 'Processing…', 'pos.success': 'Sale completed', 'pos.invoice': 'Invoice {no}', 'pos.printReceipt': 'Print receipt', 'pos.newSale': 'New sale',
  'pos.customer': 'Customer', 'pos.customerName': 'Customer name', 'pos.customerPhone': 'Customer phone', 'pos.note': 'Sale note',
  'pos.noShift': 'Open your shift to start selling', 'pos.openShift': 'Open shift', 'pos.openingCash': 'Opening cash in drawer', 'pos.shift': 'Shift {no}',
  'pos.retryHint': 'The connection failed. Your sale was NOT lost — tap Retry. It will never be charged twice.', 'pos.lowStockNotice': 'Low stock: {items}',
  'pos.discountPct': 'Percent', 'pos.discountAmt': 'Amount', 'pos.applyDiscount': 'Apply discount', 'pos.removeDiscount': 'Remove discount',
  'pos.approvalTitle': 'Manager approval', 'pos.approvalHint': 'This action needs a manager. Ask a manager to enter their credentials.',
  'pos.approve': 'Approve', 'pos.paymentRef': 'Transaction reference', 'pos.mySales': 'My sales today', 'pos.reference': 'Ref',
  'pos.reference.hint': 'Optional — last digits of card slip / InstaPay reference', 'pos.notEnough': 'Payment is less than the total',

  // payment methods
  'pay.cash': 'Cash', 'pay.card': 'Card', 'pay.instapay': 'InstaPay', 'pay.vodafone_cash': 'Vodafone Cash', 'pay.other': 'Other', 'pay.split': 'Split', 'pay.mixed': 'Mixed',

  // products
  'products.title': 'Products', 'products.new': 'New product', 'products.edit': 'Edit product', 'products.searchPh': 'Search by name (EN/AR), SKU, barcode, brand…',
  'products.sku': 'SKU / Code', 'products.barcode': 'Barcode', 'products.nameEn': 'Name (English)', 'products.nameAr': 'Name (Arabic)', 'products.brand': 'Brand',
  'products.cost': 'Cost price', 'products.price': 'Selling price', 'products.qty': 'Quantity', 'products.initialQty': 'Opening stock', 'products.minStock': 'Low-stock threshold',
  'products.supplier': 'Supplier', 'products.image': 'Image URL', 'products.variant': 'Variant', 'products.variantGroup': 'Variant group',
  'products.size': 'Size', 'products.color': 'Color', 'products.fragrance': 'Fragrance', 'products.expiry': 'Expiry date', 'products.margin': 'Margin',
  'products.generate': 'Generate', 'products.skuTaken': 'This SKU is already used', 'products.barcodeTaken': 'This barcode is already used',
  'products.stockStatus': 'Stock', 'products.stock.normal': 'In stock', 'products.stock.low': 'Low stock', 'products.stock.out': 'Out of stock',
  'products.filter.attention': 'Needs attention', 'products.created': 'Product created', 'products.updated': 'Product updated',
  'products.archiveConfirm': 'Archive this product? It will be hidden from the POS but its history is kept.', 'products.archivedMsg': 'Product archived',
  'products.restoredMsg': 'Product restored', 'products.qtyHint': 'Stock changes are recorded as purchases, adjustments or counts — never silently overwritten.',
  'products.basics': 'Basics', 'products.pricing': 'Pricing', 'products.stockSection': 'Stock', 'products.variantSection': 'Variant & details',
  'products.adjust': 'Adjust stock', 'products.newQty': 'New quantity', 'products.adjustReason': 'Reason for adjustment', 'products.adjusted': 'Stock adjusted',
  'products.history': 'Stock history', 'products.unitsSold': 'Units sold', 'products.revenue': 'Revenue', 'products.profit': 'Profit', 'products.variants': 'Other variants',
  'products.label': 'Print barcode label', 'products.receive': 'Receive stock', 'products.updatedAt': 'Last updated', 'products.createdAt': 'Created',
  'products.noCategory': 'Uncategorized', 'products.selectCategory': 'Select category', 'products.selectSupplier': 'Select supplier', 'products.labels': 'Labels to print',

  // categories & suppliers
  'categories.title': 'Categories', 'categories.new': 'New category', 'categories.nameEn': 'Name (English)', 'categories.nameAr': 'Name (Arabic)', 'categories.count': 'Products',
  'suppliers.title': 'Suppliers', 'suppliers.new': 'New supplier', 'suppliers.purchases': 'Purchases', 'suppliers.totalBought': 'Total purchased',

  // purchases
  'purchases.title': 'Purchases & Receiving', 'purchases.new': 'Receive stock', 'purchases.no': 'Purchase #', 'purchases.supplier': 'Supplier', 'purchases.reference': 'Supplier invoice / ref',
  'purchases.date': 'Date received', 'purchases.addItem': 'Add product', 'purchases.unitCost': 'Unit cost', 'purchases.lineTotal': 'Line total', 'purchases.updateCost': 'Update product cost (weighted average)',
  'purchases.saved': 'Stock received', 'purchases.items': 'Items', 'purchases.noItems': 'Add at least one product', 'purchases.pickProduct': 'Search product to add…',

  // inventory
  'inv.title': 'Inventory overview', 'inv.byCategory': 'Stock by category', 'inv.expiring': 'Expiring within 30 days', 'inv.expired': 'Expired', 'inv.slow': 'Slow movers (no sales in 30 days)',
  'inv.lastSold': 'Last sold', 'inv.never': 'Never',
  'alerts.title': 'Stock alerts', 'alerts.low': 'LOW STOCK', 'alerts.out': 'OUT OF STOCK', 'alerts.remaining': 'Remaining', 'alerts.threshold': 'Threshold',
  'alerts.suggested': 'Suggested reorder', 'alerts.sold30': 'Sold (30d)', 'alerts.review': 'Mark reviewed', 'alerts.reviewed': 'Reviewed', 'alerts.open': 'Open',
  'alerts.resolved': 'Resolved', 'alerts.active': 'Active', 'alerts.none': 'All products are above their thresholds', 'alerts.toast': '{type}: {name} — {qty} left',
  'alerts.reviewHint': 'Reviewing acknowledges the alert. It resolves automatically once stock is replenished above the threshold.', 'alerts.since': 'Since',
  'moves.title': 'Stock movements', 'moves.change': 'Change', 'moves.before': 'Before', 'moves.after': 'After', 'moves.ref': 'Reference',
  'moves.type.initial': 'Opening stock', 'moves.type.sale': 'Sale', 'moves.type.return': 'Return', 'moves.type.cancellation': 'Cancellation', 'moves.type.purchase': 'Purchase',
  'moves.type.adjustment': 'Adjustment', 'moves.type.count': 'Stock count',
  'count.title': 'Stock count', 'count.subtitle': 'Count what is physically on the shelf. Only differences are recorded, as adjustments.', 'count.system': 'System qty',
  'count.counted': 'Counted', 'count.diff': 'Difference', 'count.apply': 'Apply count', 'count.applied': 'Count applied: {n} discrepancies recorded',
  'count.changed': 'Some stock changed while you were counting (e.g. a sale). Review and apply anyway?', 'count.history': 'Previous counts', 'count.onlyDiff': 'Show differences only',
  'count.draftSaved': 'Draft is saved on this device', 'count.counter': '{done} of {total} counted', 'count.reset': 'Reset',

  // sales
  'sales.title': 'Sales & invoices', 'sales.invoice': 'Invoice', 'sales.cashier': 'Cashier', 'sales.items': 'Items', 'sales.payment': 'Payment', 'sales.searchPh': 'Invoice #, customer phone or name',
  'sales.status.completed': 'Completed', 'sales.status.partially_returned': 'Partly returned', 'sales.status.returned': 'Returned', 'sales.status.cancelled': 'Cancelled',
  'sales.detail': 'Invoice details', 'sales.unitPrice': 'Unit price', 'sales.lineTotal': 'Line total', 'sales.returnedQty': 'Returned', 'sales.reprint': 'Reprint receipt',
  'sales.cancel': 'Cancel invoice', 'sales.cancelTitle': 'Cancel this invoice?', 'sales.cancelHint': 'All remaining items return to stock and a cancellation record is created. The original invoice is kept.',
  'sales.cancelled': 'Invoice cancelled', 'sales.returnItems': 'Return items', 'sales.history': 'Returns on this invoice', 'sales.approvedBy': 'Discount approved by',
  'sales.cost': 'Cost', 'sales.profit': 'Profit',

  // returns
  'returns.title': 'Returns & refunds', 'returns.new': 'New return', 'returns.lookup': 'Find invoice', 'returns.invoicePh': 'Invoice number, e.g. INV-20261019-0001',
  'returns.sold': 'Sold', 'returns.alreadyReturned': 'Already returned', 'returns.returnQty': 'Return qty', 'returns.restock': 'Back to stock',
  'returns.restockHint': 'Untick if the item is damaged and cannot be resold', 'returns.refund': 'Refund', 'returns.refundMethod': 'Refund method',
  'returns.submit': 'Process return', 'returns.done': 'Return {no} recorded', 'returns.no': 'Return #', 'returns.kind.return': 'Return', 'returns.kind.cancellation': 'Cancellation',
  'returns.nothing': 'Select at least one item to return', 'returns.notFound': 'Invoice not found', 'returns.reasonPh': 'Why is the customer returning this?',

  // expenses
  'exp.title': 'Expenses', 'exp.new': 'Record expense', 'exp.fromDrawer': 'Paid from the cash drawer (current shift)', 'exp.void': 'Void', 'exp.voidTitle': 'Void this expense?',
  'exp.voided': 'Voided', 'exp.byCategory': 'By category', 'exp.saved': 'Expense recorded',

  // shifts
  'shift.title': 'Cashier shifts', 'shift.my': 'My shift', 'shift.open': 'Open shift', 'shift.close': 'Close shift', 'shift.opened': 'Opened', 'shift.closed': 'Closed',
  'shift.openingCash': 'Opening cash', 'shift.cashSales': 'Cash sales', 'shift.cashRefunds': 'Cash refunds', 'shift.cashIn': 'Cash in', 'shift.cashOut': 'Cash out',
  'shift.drawerExpenses': 'Drawer expenses', 'shift.expected': 'Expected cash', 'shift.counted': 'Counted cash', 'shift.difference': 'Difference', 'shift.over': 'Over',
  'shift.short': 'Short', 'shift.balanced': 'Balanced', 'shift.nonCash': 'Non-cash payments (not in drawer)', 'shift.movements': 'Cash movements',
  'shift.addCash': 'Cash in / out', 'shift.noOpen': 'You have no open shift', 'shift.closeHint': 'Count the cash in the drawer and enter the total.',
  'shift.number': 'Shift #', 'shift.sales': 'Sales', 'shift.status.open': 'Open', 'shift.status.closed': 'Closed', 'shift.summary': 'Shift summary', 'shift.print': 'Print Z-report',
  'cash.sale': 'Sale', 'cash.refund': 'Refund', 'cash.cash_in': 'Cash in', 'cash.cash_out': 'Cash out', 'cash.expense': 'Expense',

  // reports
  'reports.title': 'Sales & profit reports', 'reports.pl': 'Profit & loss', 'reports.byCategory': 'Sales by category', 'reports.mostProfitable': 'Most profitable products',
  'reports.expensesByCat': 'Expenses by category', 'reports.revenue': 'Revenue', 'reports.units': 'Units', 'reports.profit': 'Profit', 'reports.subtotalBefore': 'Sales before discounts',
  'reports.lessDiscounts': 'Less discounts', 'reports.lessRefunds': 'Less refunds & cancellations', 'reports.lessCogs': 'Less cost of goods sold', 'reports.lessExpenses': 'Less expenses',
  'reports.cogsNote': 'Cost of goods uses the cost recorded on each sale (weighted average at the time of sale), not today’s cost.',

  // users
  'users.title': 'Users & permissions', 'users.new': 'New user', 'users.username': 'Username', 'users.displayName': 'Display name', 'users.role': 'Role',
  'users.role.manager': 'Manager', 'users.role.cashier': 'Cashier', 'users.lastLogin': 'Last login', 'users.permissions': 'Extra permissions (cashiers)',
  'users.maxDiscount': 'Max discount without approval (%)', 'users.resetPassword': 'Reset password', 'users.tempPassword': 'Temporary password',
  'users.tempHint': 'The user must change it at next sign-in.', 'users.deactivate': 'Deactivate', 'users.activate': 'Activate',
  'perm.sales.view_all': 'View all sales (not only own)', 'perm.discount.apply': 'Apply discounts (up to the limit)', 'perm.returns.process': 'Process returns without approval',
  'perm.expenses.create': 'Record expenses', 'perm.products.view_cost': 'See cost prices',

  // audit
  'audit.title': 'Audit log', 'audit.action': 'Action', 'audit.entity': 'Record', 'audit.details': 'Details', 'audit.ip': 'IP',

  // settings
  'settings.title': 'System settings', 'settings.store': 'Store details', 'settings.storeName': 'Store name', 'settings.taglineEn': 'Tagline (English)', 'settings.taglineAr': 'Tagline (Arabic)',
  'settings.addressEn': 'Address (English)', 'settings.addressAr': 'Address (Arabic)', 'settings.instagram': 'Instagram handle', 'settings.receipt': 'Receipt',
  'settings.footerEn': 'Thank-you message (English)', 'settings.footerAr': 'Thank-you message (Arabic)', 'settings.policyEn': 'Return policy (English)', 'settings.policyAr': 'Return policy (Arabic)',
  'settings.paperWidth': 'Receipt paper width', 'settings.payments': 'Payment methods', 'settings.otherLabel': 'Label for “Other” method', 'settings.inventory': 'Inventory & returns',
  'settings.defaultMin': 'Default low-stock threshold', 'settings.reorderDays': 'Reorder suggestion covers (days)', 'settings.returnDays': 'Return window (days, 0 = no limit)',
  'settings.expenseCats': 'Expense categories (comma separated)', 'settings.backup': 'Backups', 'settings.backupNow': 'Create backup now', 'settings.backupHint': 'An automatic backup is made every day. Download copies regularly and keep them off this computer.',
  'settings.download': 'Download', 'settings.backupDone': 'Backup created', 'settings.integrity': 'Data integrity check', 'settings.runCheck': 'Run check',
  'settings.integrityOk': 'All checks passed — stock, sales, payments and returns reconcile.', 'settings.integrityBad': '{n} check(s) found inconsistencies',
  'settings.preview': 'Receipt preview',
  'check.stock_vs_movements': 'Product quantity equals its movement ledger', 'check.sale_totals': 'Invoice totals equal their lines', 'check.sale_net_lines': 'Discount allocation reconciles',
  'check.sale_payments': 'Payments equal invoice totals', 'check.sales_without_items': 'Every invoice has items', 'check.sale_stock_deduction': 'Every sold unit was deducted exactly once',
  'check.returned_qty': 'Returned quantities match return records', 'check.return_totals': 'Refund totals equal their lines', 'check.alerts_vs_stock': 'Alerts match stock levels',
  'check.sync_failures': 'No failed Google Sheets syncs',

  // sync
  'sync.title': 'Google Sheets connection', 'sync.status': 'Sync status', 'sync.connected': 'Connected', 'sync.notConfigured': 'Not configured', 'sync.demo': 'Test mode (in-memory)',
  'sync.pending': 'Waiting to sync', 'sync.failed': 'Failed (will retry)', 'sync.lastSuccess': 'Last successful sync', 'sync.lastError': 'Last error',
  'sync.spreadsheet': 'Spreadsheet ID or URL', 'sync.serviceAccount': 'Service account', 'sync.saveId': 'Save spreadsheet', 'sync.test': 'Test & initialize tabs',
  'sync.run': 'Sync now', 'sync.resync': 'Full re-sync', 'sync.resyncHint': 'Checks that all 17 tabs and their headers exist and creates anything missing. Never deletes or overwrites data.',
  'sync.missing': 'Missing configuration', 'sync.missing.GOOGLE_SERVICE_ACCOUNT_FILE': 'Service-account key on the server (GOOGLE_SERVICE_ACCOUNT_FILE)',
  'sync.missing.spreadsheet_id': 'Spreadsheet ID', 'sync.missing.valid_spreadsheet_id': 'A valid spreadsheet ID', 'sync.log': 'Sync log', 'sync.failedItems': 'Failed records',
  'sync.howItWorks': 'Your Google Spreadsheet is the database. Every change is validated first and written under a lock by the Apps Script backend, so two tablets can never sell the same last unit and a retried sale is never charged twice.',
  'sync.shareHint': 'Share the spreadsheet with the service-account email as Editor.', 'sync.initOk': 'Tabs verified. Created: {created}', 'sync.queued': '{n} records queued',
  'sync.badge.ok': 'Synced', 'sync.badge.pending': '{n} pending', 'sync.badge.failed': 'Sync error', 'sync.badge.off': 'Sheets off', 'sync.never': 'Never', 'sync.tab': 'Tab',
  'sync.dbRows': 'Database', 'sync.sheetRows': 'Sheet',

  'sync.openSheet': 'Open spreadsheet',
  'sync.tabsTitle': 'Tabs',
  'sync.rows': 'Records',
  'sync.backend': 'Backend',
  'sync.apiUrl': 'Backend URL (Apps Script web app)',
  'auth.serverTitle': 'Connect to your store',
  'auth.serverHint': 'Paste the Apps Script web-app URL of your AURIX spreadsheet (ends with /exec).',
  'auth.serverUrl': 'Backend URL',
  'auth.serverSave': 'Connect',
  'auth.serverChange': 'Change backend',
  'auth.serverInvalid': 'That does not look like an Apps Script web-app URL',
  'err.not_configured': 'The backend URL is not set',
  'err.busy': 'The system is busy — please retry',
  'err.not_initialized': 'The spreadsheet is not initialized yet (run setup in Apps Script)',
  // receipt
  'receipt.invoice': 'Invoice', 'receipt.date': 'Date', 'receipt.cashier': 'Cashier', 'receipt.item': 'Item', 'receipt.subtotal': 'Subtotal', 'receipt.discount': 'Discount',
  'receipt.total': 'TOTAL', 'receipt.paid': 'Paid', 'receipt.received': 'Received', 'receipt.change': 'Change', 'receipt.customer': 'Customer', 'receipt.reprint': 'REPRINT',
  'receipt.returned': 'Items returned on this invoice: {n}',

  // errors (server codes)
  'err.invalid_credentials': 'Invalid username or password', 'err.too_many_attempts': 'Too many failed attempts. Please wait a few minutes.', 'err.unauthenticated': 'Please sign in again',
  'err.forbidden': 'You do not have permission for this action', 'err.validation_error': 'Please check the highlighted fields', 'err.insufficient_stock': 'Not enough stock for {sku} (available: {available})',
  'err.shift_required': 'Open a cashier shift first', 'err.shift_already_open': 'You already have an open shift', 'err.duplicate_sku': 'This SKU already exists',
  'err.duplicate_barcode': 'This barcode already exists', 'err.manager_approval_required': 'Manager approval is required', 'err.manager_approval_invalid': 'Manager credentials are invalid',
  'err.insufficient_payment': 'Payment is less than the total', 'err.overpayment_non_cash': 'Card/digital payments cannot exceed the total', 'err.return_exceeds_sold': 'You cannot return more than was sold',
  'err.nothing_to_return': 'This invoice has nothing left to return', 'err.idempotency_key_reused': 'This transaction was already processed differently', 'err.network': 'Cannot reach the server. Check the connection and retry.',
  'err.password_too_short': 'Password must be at least 8 characters', 'err.password_needs_letter_and_digit': 'Password needs at least one letter and one digit', 'err.wrong_password': 'Current password is incorrect',
  'err.last_manager': 'At least one active manager is required', 'err.duplicate_username': 'Username already exists', 'err.duplicate_category': 'A category with this name exists',
  'err.not_found': 'Not found', 'err.sale_not_found': 'Invoice not found', 'err.product_not_found': 'Product not found', 'err.discount_exceeds_total': 'Discount is larger than the total',
  'err.discount_exceeds_line': 'Discount is larger than the line total', 'err.cash_out_exceeds_drawer': 'Not enough cash in the drawer', 'err.return_window_expired': 'The return window for this invoice has passed',
  'err.invalid_spreadsheet_id': 'That is not a valid spreadsheet ID', 'err.stock_changed_during_count': 'Stock changed during the count', 'err.payment_method_disabled': 'This payment method is disabled',
  'err.product_archived': 'This product is archived', 'err.password_change_required': 'Please change your password first', 'err.csrf_check_failed': 'Security check failed — reload the page',
  'err.no_change': 'Quantity is unchanged', 'err.unknown_expense_category': 'Unknown expense category', 'err.alert_not_open': 'Alert already reviewed', 'err.invalid_range': 'Invalid date range',
  'err.qty_not_editable': 'Use a stock adjustment to change quantity', 'err.password_unchanged': 'New password must differ from the current one',
};
export default en;
export type Dict = typeof en;
export type TKey = keyof Dict;
