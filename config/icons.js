const lucide = require('lucide-static');

const iconNames = {
  location_city: 'Building2', dashboard: 'LayoutDashboard', space_dashboard: 'LayoutDashboard',
  fact_check: 'ClipboardCheck', account_tree: 'Network', groups: 'Users', assignment: 'ClipboardList',
  assignment_ind: 'UserRoundCheck', add_location_alt: 'MapPinPlus', person: 'UserRound', person_add: 'UserRoundPlus',
  logout: 'LogOut', notifications: 'Bell', notifications_active: 'BellRing', arrow_forward: 'ArrowRight',
  arrow_back: 'ArrowLeft', arrow_outward: 'ArrowUpRight', more_horiz: 'Ellipsis', info: 'Info', lock: 'LockKeyhole',
  check_circle: 'CircleCheck', road: 'Route', delete: 'Trash2', water_drop: 'Droplets', lightbulb: 'Lightbulb',
  water: 'Waves', edit_location_alt: 'MapPin', visibility: 'Eye', send: 'Send', search_off: 'SearchX', inbox: 'Inbox',
  manage_search: 'SearchCheck', engineering: 'Wrench', task_alt: 'CircleCheck', analytics: 'ChartNoAxesColumnIncreasing',
  assured_workload: 'Landmark', support_agent: 'CircleHelp', location_on: 'MapPin', priority_high: 'TriangleAlert',
  add_photo_alternate: 'ImagePlus', play_arrow: 'Play', sync_alt: 'ArrowLeftRight', chat: 'MessageCircle',
  assignment_turned_in: 'ClipboardCheck', person_add_alt: 'UserRoundPlus', notifications_none: 'Bell',
  home: 'House', close: 'X', search: 'Search', locate_fixed: 'LocateFixed', menu: 'Menu', tune: 'SlidersHorizontal', calendar: 'CalendarDays',
  water_damage: 'Waves', image: 'Image', construction: 'Construction', track_changes: 'Eye', handshake: 'Handshake',
  task: 'ClipboardList', add: 'Plus', bar_chart: 'ChartNoAxesColumnIncreasing', block: 'OctagonX',
  login: 'LogIn', help: 'CircleHelp',
  person_remove: 'UserRoundX', undo: 'Undo2', schedule: 'Clock', remove_circle_outline: 'CircleMinus',
  refresh_cw: 'RefreshCw',
  map: 'Map',
  // Lucide PascalCase exports can be used directly when desired.
};

function icon(name) {
  const key = iconNames[name] || String(name).split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  const svg = lucide[key] || lucide.CircleHelp;
  return svg.replace('<svg', '<svg aria-hidden="true" focusable="false"');
}

module.exports = { icon };
