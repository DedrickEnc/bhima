angular.module('bhima.controllers')
.controller('journal.grid', [
  '$scope',
  '$translate',
  '$filter',
  '$q',
  'precision',
  'validate',
  'appstate',
  function ($scope, $translate, $filter, $q, precision, validate, appstate) {

    var dependencies = {}, ready = $q.defer();

    dependencies.journal_bis = {
      identifier : 'uuid',
      query : 'journal_list/'
    };

    var columns = [
        {headerName: '', field: 'item', width: 150, cellRenderer: {renderer: 'group'}},
        // {headerName: $translate.instant('COLUMNS.TRANS_ID')       , field: 'trans_id', width : 100, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.DATE'), field: 'trans_date', cellRenderer : formatDate, width : 100, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.DESCRIPTION')    , field: 'description', width : 200, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.ACCOUNT_NUMBER') , field: 'account_number', width : 100, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.DEB_EQUIV')      , field: 'debit_equiv', width : 100, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.CRE_EQUIV')      , field: 'credit_equiv', width : 100, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.DC_TYPE')        , field: 'deb_cred_type', width : 50, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.COST_CENTER')    , field: 'cc', width : 100, headerGroup: 'Transaction'},
        {headerName: $translate.instant('COLUMNS.PROFIT_CENTER')  , field: 'pc', width : 100, headerGroup: 'Transaction'}
    ];


    //test
    function initialise (models){

      $scope.gridOptions = {
        columnDefs: columns,
        rowData : models.journal_bis.data,
        pinnedColumnCount : 7,
        rowSelection: 'single',
        groupKeys: ['trans_id'],
        groupHeaders: true,
        groupDefaultExpanded: true,
        groupIncludeFooter: true,
        groupAggFields: ['debit_equiv','credit_equiv'],
        enableColResize: true,
        enableSorting: false,
        groupSuppressAutoColumn: true,
        enableFilter: false
      }
    }

    var formatDate = function (val) {
      return $filter('date')(val.value);
    }

    validate.process(dependencies)
    .then(initialise)
    .catch(function (error) {
      ready.reject(error);
    });
  }]);





















    //   // set up grid properties
    //   columns = [
    //     // {id: 'uuid'           , name: $translate.instant('COLUMNS.ID')             , field: 'uuid'           , sortable: true },
    //     // {id: 'fiscal_year_id' , name: $translate.instant('COLUMNS.FISCAL_YEAR_ID') , field: 'fiscal_year_id' , sortable: true },
    //     // {id: 'period_id'      , name: $translate.instant('COLUMNS.PERIOD_ID')      , field: 'period_id'      , sortable: true },
    //     {id: 'trans_id'       , name: $translate.instant('COLUMNS.TRANS_ID')       , field: 'trans_id'       , sortable: true },
    //     {id: 'trans_date'     , name: $translate.instant('COLUMNS.DATE')           , field: 'trans_date'     , formatter : formatDate, sortable: true},
    //     {id: 'description'    , name: $translate.instant('COLUMNS.DESCRIPTION')    , field: 'description'    , width: 110, editor: Slick.Editors.Text},
    //     {id: 'account_id'     , name: $translate.instant('COLUMNS.ACCOUNT_NUMBER') , field: 'account_number' , sortable: true }                  ,
    //     {id: 'debit_equiv'    , name: $translate.instant('COLUMNS.DEB_EQUIV')      , field: 'debit_equiv'    , groupTotalsFormatter: totalFormat , sortable: true, maxWidth: 100, editor:Slick.Editors.Text},
    //     {id: 'credit_equiv'   , name: $translate.instant('COLUMNS.CRE_EQUIV')      , field: 'credit_equiv'   , groupTotalsFormatter: totalFormat , sortable: true, maxWidth: 100, editor:Slick.Editors.Text},
    //     // {id: 'deb_cred_uuid'  , name: 'ID Source'                                  , field: 'deb_cred_uuid'},
    //     {id: 'deb_cred_type'  , name: $translate.instant('COLUMNS.DC_TYPE')        , field: 'deb_cred_type'},
    //     // {id: 'inv_po_id'      , name: $translate.instant('COLUMNS.INVPO_ID')       , field: 'inv_po_id'},
    //     {id: 'comment'        , name: $translate.instant('COLUMNS.COMMENT')        , field: 'comment'        , sortable : true, editor: Slick.Editors.Text} ,
    //     {id: 'cc_id'          , name: $translate.instant('COLUMNS.COST_CENTER')    , field: 'cc'          , sortable : true},
    //     {id: 'pc_id'          , name: $translate.instant('COLUMNS.PROFIT_CENTER')  , field: 'pc'          , sortable : true}
    //   ];

    //   options = {
    //     enableCellNavigation: true,
    //     enableColumnReorder: true,
    //     forceFitColumns: true,
    //     editable: true,
    //     rowHeight: 30,
    //     autoEdit: false
    //   };

    //   populate();
    // }
