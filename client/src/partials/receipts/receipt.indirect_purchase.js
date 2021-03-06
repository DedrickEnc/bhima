angular.module('bhima.controllers')
.controller('receipt.indirect_purchase', [
  '$scope',
  'validate',
  'appstate',
  'messenger',
  function ($scope, validate, appstate, messenger) {
    var dependencies = {}, model = $scope.model = {common : {}};

    dependencies.indirectPurchase = {
        query : {
          identifier : 'uuid',
          tables : {
            purchase : { columns : ['uuid', 'reference', 'cost', 'creditor_uuid', 'employee_id', 'project_id', 'purchase_date', 'note'] },
            employee : { columns : ['code', 'name', 'prenom', 'postnom'] }
          },
          join : ['purchase.employee_id=employee.id']          
        }
      };

    function buildInvoice (res) {
      model.indirectPurchase = res.indirectPurchase.data.pop();
    }

  	appstate.register('receipts.commonData', function (commonData) {
  		commonData.then(function (values) {
        model.common.location = values.location.data.pop();
        model.common.InvoiceId = values.invoiceId;
        model.common.enterprise = values.enterprise.data.pop();
        dependencies.indirectPurchase.query.where =  ['purchase.uuid=' + values.invoiceId];
        validate.process(dependencies)
        .then(buildInvoice)
        .catch(function (err){
          messenger.danger('error', err);
        });
  		});     
    });    
  }
]);