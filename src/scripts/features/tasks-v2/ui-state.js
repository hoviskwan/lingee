/* T00 结构拆分：ui-state。保留原交互；事件在 init* 中按原顺序注册。 */
var LIST_FIELDS = [
  { id:'code', name:'编号' }, { id:'title', name:'标题', required:true },
  { id:'module', name:'模块' }, { id:'status', name:'状态' }, { id:'type', name:'任务类型' },
  { id:'priority', name:'优先级' }, { id:'assignee', name:'处理人' },
  { id:'project', name:'项目' },
  { id:'created', name:'创建时间' },
  { id:'desc', name:'描述' },
];

var DEFAULT_LIST_FIELD_ORDER = LIST_FIELDS.map(function(field) { return field.id; });

var taskViewState = {
  layout: 'board', viewMode: 'slide', scope: 'all', groupBy: 'status', sortBy: 'updatedAt', sortDir: 'desc',
  search: '', filters: [], selectedIds: new Set(), activeViewId: 'all',
  showSubtasks: true,
  cardProperties: { priority:true, description:false, assignee:true, startDate:false, project:false, childProgress:true },
  listFieldOrder: DEFAULT_LIST_FIELD_ORDER.slice(), listFieldVisibility: { desc:false },
  editingTaskId: null, drawerTaskId: null, editingParentId: null,
  collapsedBoardGroups: new Set(),
};

var els = {};

function cacheEls() {
  var ids = [
    'tkViewTabs','tkViewAdd','tkViewMenu','tkViewMenuNew','tkViewManage','tkViewOverflow','tkViewOverflowBtn','tkOverflowMenu',
    'tkSearch','tkFilterBtn','tkFilterLabel','tkFilterPanel','tkFilterPanelBody','tkFilterSubmenu','tkFilterChips','tkToolbarNewGroup','tkToolbarNew','tkToolbarNewArrow','tkToolbarNewMenu','tkImportExcel','tkExportExcelTemplate',
    'tkDisplayBtn','tkDisplayPopover','tkFieldsBtn','tkFieldsPopover','tkFieldsClose','tkFieldsSearch','tkFieldsList','tkFieldsSummary','tkGroupSelect','tkViewModeSelect','tkSortSelect','tkSortDirection','tkShowSubtasks','tkCardProperties','tkCardPropsSection',
    'tkLayoutToggle','tkBody','tkBoard','tkBoardScroll','tkList','tkListBody','tkListHead','tkSplitEmpty',
    'tkCheckAll','tkEmpty','tkResetFilter','tkBulkBar','tkBulkCount','tkBulkClear',
    'tkDrawer','tkDrawerClickaway','tkDrawerResize','tkDrawerClose','tkDrawerTitle','tkDrawerCode','tkDrawerBody','tkDrawerMore','tkDrawerChat',
    'tkModalOverlay','tkModalClose','tkModalCancel','tkModalSave','tkModalTitle',
    'tkFormTitle','tkFormDesc','tkFormStatus','tkFormPriority','tkFormAssignee','tkFormProject','tkFormDue','tkFormLabels',
    'tkSaveViewOverlay','tkSaveViewClose','tkSaveViewCancel','tkSaveViewConfirm','tkSaveViewName','tkSaveViewVisibility','tkSaveViewScope','tkSaveViewLayout','tkSaveViewSummary',
    'tkManageViewsOverlay','tkManageViewsClose','tkManageViewsCancel','tkManageList',
    'tkBulkStatusMenu','tkBulkAssigneeMenu',
  ];
  ids.forEach(function (id) { els[id] = document.getElementById(id); });
}

function setTaskViewState(patch) { Object.assign(taskViewState, patch); }

export { LIST_FIELDS, DEFAULT_LIST_FIELD_ORDER, cacheEls, taskViewState, els, setTaskViewState };
