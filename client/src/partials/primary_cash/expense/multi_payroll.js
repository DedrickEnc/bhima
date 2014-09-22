angular.module('bhima.controllers')
.controller('multi_payroll', [
  '$scope',
  '$routeParams',
  '$translate',
  '$http',
  'messenger',
  'validate',
  'appstate',
  'connect',
  '$location',
  'util',
  'appcache',
  'exchange',
  '$q',
  'ipr',
  function ($scope, $routeParams, $translate, $http, messenger, validate, appstate, connect, $location, util, Appcache, exchange, $q, ipr) {
    var dependencies = {},
        cache = new Appcache('payroll'), session = $scope.session = {configured : false, complete : false, data : {}, rows : []};
    session.cashbox = $routeParams.cashbox;

    dependencies.cash_box = {
      required : true,
      query : {
        tables : {
          'cash_box_account_currency' : {
            columns : ['id', 'currency_id', 'account_id']
          },
          'currency' : {
            columns : ['symbol', 'min_monentary_unit']
          },
          'cash_box' : {
            columns : ['id', 'text', 'project_id']
          }
        },
        join : [
          'cash_box_account_currency.currency_id=currency.id',
          'cash_box_account_currency.cash_box_id=cash_box.id'
        ],
        where : [
          'cash_box_account_currency.cash_box_id=' + session.cashbox
        ]
      }
    };

    dependencies.exchange_rate = {
      required : true,
      query : {
        tables : {
          'exchange_rate' : {
            columns : ['id', 'enterprise_currency_id', 'foreign_currency_id', 'date', 'rate']
          }
        },
        where : ['exchange_rate.date='+util.sqlDate(new Date())]
      }
    };

    dependencies.employees = {
      required : true,
      query : 'employee_list/'
    };

    dependencies.cashier = {
      query : 'user_session'
    };

    dependencies.paiement_period = {
      query : {
        tables : {
          'paiement_period' : {
            columns : ['id', 'config_tax_id', 'config_rubric_id', 'label', 'dateFrom', 'dateTo']
          }
        }
      }
    };

    dependencies.pcash_module = {
      required : true,
      query : {
        tables : {
          'primary_cash_module' : {
            columns : ['id']
          }
        },
        where : ['primary_cash_module.text=Payroll']
      }
    };

    dependencies.enterprise = {
      query : {
        tables : {
          'enterprise' : {
          columns : ['currency_id']
        }
        }
      }
    };

    cache.fetch('paiement_period')
    .then(readConfig)
    .then(function () {
      return cache.fetch('selectedItem');
    })
    .then(load)
    .then(function () {
        appstate.register('project', function (project) {
          $scope.project = project;
          validate.process(dependencies)
          .then(init, function (err) {
             $translate('PRIMARY_CASH.EXPENSE.LOADING_ERROR')
              .then(function (value) {
                messenger.danger(value);
              }); 
          });     
        });
    });   

    function load (selectedItem) {
      if (!selectedItem) { return ; }
      session.loading_currency_id = selectedItem.currency_id;
      session.selectedItem = selectedItem;
      return $q.when();
    }   

    function readConfig (pp) {

      if(!pp) {return;}
      session.pp = pp;
      session.configured = true;
      session.complete = true;
      return $q.when();
    }


    function reconfigure() {
      cache.remove('paiement_period');
      session.pp = null;
      session.configured = false;
      session.complete = false;
      session.isEmployeeSelected = false;
    } 

    function init (model) {
      console.log('model', model);
      session.model = model;      
      getPPConf()
      .then(getOffDayCount)
      .then(getEmployees)
      .catch(function (err) {
        console.log('err', err);
      });
    }

    function getEmployees (model) {

      model.employees.data.forEach(function (emp) {
        new employeeRow(emp)
        .then(function (row) {
          row.emp.basic_salary = 
            exchange.convertir(
              row.emp.basic_salary,
              session.model.enterprise.data[0].currency_id,
              session.selectedItem.currency_id,
              util.sqlDate(new Date())
            );     
          session.rows.push(row);
          console.log('les employeeRows', session.rows);
        });        
      });
    }

    function employeeRow (emp) {
      var self = this;
      var def = $q.defer();
      getHollyDayCount(emp)
      .then(function (hl){
        self.hollyday = hl;
        self.off_day = session.data.off_day;
        self.emp = emp;
        self.working_day = session.data.max_day - (hl + session.data.off_day);
        self.fam_allow = 0;
        self.transport = 0;
        self.seniority = 0;
        self.av_salary = 0;
        self.other = 0;
        self.onem = 0;
        self.inpp = 0;
        self.iere = 0;
        self.visible = false;
        return getHousing(self);        
      })
      .then(function (hous) {
        self.housing = hous;
        return getEmployeeINSS(self);
      })
      .then(function (employee_INSS) {
        self.employee_inss = employee_INSS;
        return getIPR(self);        
      })
      .then(function (IPR){
        self.ipr = IPR;
        return getEnterpriseINSS(self);        
      })
      .then(function (enterprise_INSS){
        self.enterprise_inss = enterprise_INSS;
        def.resolve(self);
      });
      return def.promise;
    }

    function getIPR() {
      var def = $q.defer();
      ipr.calculate()
      .then(function(tranches){
        console.log(tranches);
        def.resolve(2);
      });

      return def.promise;
    }

    function getPPConf() {     

      dependencies.paiement_period_conf = {
        required : true,
        query : {
          tables : {
            'config_paiement_period' : {
              columns : ['id', 'weekFrom', 'weekTo']
            }
          },
          where : ['config_paiement_period.paiement_period_id>=' + session.pp.id]
        }
      };

      dependencies.rubric_config = {
        required : true,
        query : {
          tables : {
            'config_rubric' : {
              columns : ['id', 'label']
            },
            'config_rubric_item' : {
              columns : ['rubric_id', 'payable']
            },
            'rubric' : {
              columns : ['abbr', 'is_percent', 'is_discount', 'value']
            }
          },
          join : [
            'config_rubric.id=config_rubric_item.config_rubric_id',
            'rubric.id=config_rubric_item.rubric_id'
          ],
          where : [
            'config_rubric.id=' + session.pp.config_rubric_id
          ]
        }
      };

      dependencies.tax_config = {
        required : true,
        query : {
          tables : {
            'config_tax' : {
              columns : ['id', 'label']
            },
            'config_tax_item' : {
              columns : ['tax_id', 'payable']
            },
            'tax' : {
              columns : ['abbr', 'is_percent', 'value', 'account_id']
            }
          },
          join : [
            'config_tax.id=config_tax_item.config_tax_id',
            'tax.id=config_tax_item.tax_id'
          ],
          where : [
            'config_tax.id=' + session.pp.config_tax_id
          ]
        }
      };

      return validate.process(dependencies, ['paiement_period_conf', 'rubric_config', 'tax_config']);
    }

    function getOffDayCount (model) {
      
      dependencies.offDays = {
        query : {
          tables : {
            'offday' : {
              columns : ['id', 'label', 'date', 'percent_pay']
            }
          },
          where : ['offday.date>=' + util.sqlDate(model.paiement_period.data[0].dateFrom), 'AND', 'offday.date<=' + util.sqlDate(model.paiement_period.data[0].dateTo)]
        }
      };     

      validate.process(dependencies, ['offDays'])
      .then(function (model) {
        var offdays = model.offDays.data;
        var pp_confs = model.paiement_period_conf.data;
        var nb_offdays = 0;
        session.data.max_day = getMaxDays(pp_confs);
        offdays.forEach(function (offDay) {
          for(var i = 0; i < pp_confs.length; i++){
            if ((util.isDateAfter(offDay.date, pp_confs[i].weekFrom) || util.areDatesEqual(offDay.date, pp_confs[i].weekFrom)) &&
                (util.isDateAfter(pp_confs[i].weekTo, offDay.date) || util.areDatesEqual(offDay.date, pp_confs[i].weekTo))) {
              nb_offdays++;
            }
          }
        });

        session.data.off_day = nb_offdays;
      });
      return $q.when(model);
    }

    function getMaxDays (ppcs) {
      var nb = 0;
      ppcs.forEach(function (item) {
        nb += (new Date(item.weekTo).getDate() - new Date(item.weekFrom).getDate());
      });

      return nb;
    }

    function getHollyDayCount (employee) {
      var defer = $q.defer();
      var som = 0;
      var pp = session.model.paiement_period.data[0];
 

      connect.fetch('/hollyday_list/' + JSON.stringify(pp) + '/' + employee.id)
      .then(function (res) {
        var hollydays = res;
        if(hollydays.length) {
          var pp_confs = session.model.paiement_period_conf.data;
          var soms = [];

          hollydays.forEach(function (h) {
            var nb = 0;
            function getValue (ppc) {
              //paiement period config === ppc
              var date_pweekfrom = new Date(ppc.weekFrom);
              var date_pweekto = new Date(ppc.weekTo);

              var date_hdatefrom = new Date(h.dateFrom);
              var date_hdateto = new Date(h.dateTo);

              var num_pweekfrom = date_pweekfrom.setHours(0,0,0,0);
              var num_pweekto = date_pweekto.setHours(0,0,0,0);

              var num_hdatefrom = date_hdatefrom.setHours(0,0,0,0);            
              var num_hdateto = date_hdateto.setHours(0,0,0,0);

              var minus_right = 0, minus_left = 0;

              if(num_pweekto > num_hdateto){
                minus_right = date_pweekto.getDate() - date_hdateto.getDate();
              }

              if(num_pweekfrom < num_hdatefrom){
                minus_left = date_hdatefrom.getDate() - date_pweekfrom.getDate();
              }

              var total = date_pweekto.getDate() - date_pweekfrom.getDate();
              if(minus_left > total) { return 0; }
              if(minus_right > total) { return 0; } 
              return total - (minus_left + minus_right);
            }

            pp_confs.forEach(function (ppc) {
              nb += getValue(ppc);
            });
            soms.push(nb);
          });

          som = soms.reduce(function (x, y){
            return x+y;
          }, 0);

          defer.resolve(som); 
        }else{
          defer.resolve(0);
        }               
      });
      return defer.promise;
    }

    function getHousing (row) {
      var rubrics = session.model.rubric_config.data, housing = 0;
      if(!rubrics.length) return $q.when(housing);

      var item = rubrics.filter(function (item) {
        return item.abbr === "HOUS";
      })[0];

      if(item) {
        housing = (item.is_percent) ? 
        (row.emp.basic_salary * item.value) / 100 : item.value;    
      }

      housing = exchange.convertir(
          housing,
          session.model.enterprise.data[0].currency_id,
          session.selectedItem.currency_id,
          util.sqlDate(new Date())
      );
      return $q.when(housing);      
    }

    function getEmployeeINSS (row) {
      var taxes = session.model.tax_config.data, employee_inss = 0;
      if(!taxes.length) return $q.when(employee_inss);

      var item = taxes.filter(function (item) {
        return item.abbr === "INS1";
      })[0];

      if(item) {
        employee_inss = (item.is_percent) ? 
        (row.emp.basic_salary * item.value) / 100 : item.value;    
      }

      employee_inss = exchange.convertir(
          employee_inss,
          session.model.enterprise.data[0].currency_id,
          session.selectedItem.currency_id,
          util.sqlDate(new Date())
      );
      return $q.when(employee_inss);      
    }

    function getEnterpriseINSS (row) {
      var taxes = session.model.tax_config.data, enterprise_inss = 0;
      if(!taxes.length) return $q.when(enterprise_inss);

      var item = taxes.filter(function (item) {
        return item.abbr === "INS2";
      })[0];

      if(item) {
        enterprise_inss = (item.is_percent) ? 
        (row.emp.basic_salary * item.value) / 100 : item.value;    
      }

      enterprise_inss = exchange.convertir(
          enterprise_inss,
          session.model.enterprise.data[0].currency_id,
          session.selectedItem.currency_id,
          util.sqlDate(new Date())
      );
      return $q.when(enterprise_inss);      
    }


    function setCashAccount(cashAccount) {
      if (cashAccount) {
        session.loading_currency_id = session.selectedItem.currency_id;
        session.selectedItem = cashAccount;        
        cache.put('selectedItem', cashAccount);
      }
    }

    function initialiseEmployee (selectedEmployee) {
      session.data.working_day = 0;
      session.data.fam_allow = 0;
      session.data.transport = 0;
      session.data.seniority = 0;
      // session.isEmployeeSelected = selectedEmployee ? selectEmployee(selectedEmployee) : false; 
      getHollyDayCount(session.model)
      .then(getHousing);
    }

    function formatPeriod (pp) {
      return [pp.label, util.sqlDate(pp.dateFrom), util.sqlDate(pp.dateTo)].join(' / ');
    }

    function setConfiguration (pp) {
      cache.put('paiement_period', pp);
      session.configured = true;
      session.pp = pp;
      session.complete = true;
    }


    function selectEmployee (employee) {
      session.selectedEmployee = employee; 
      session.selectedEmployee.basic_salary = exchange.convertir(session.selectedEmployee.basic_salary, session.model.enterprise.data[0].currency_id, session.selectedItem.currency_id, util.sqlDate(new Date()));     
      return true;
    }

    $scope.$watch('session.selectedItem', function (nval, oval) {

       if(session.rows.length) {
          session.rows.forEach(function (row) {
            row.emp.basic_salary = 
              exchange.convertir(
                row.emp.basic_salary,
                session.loading_currency_id,
                session.selectedItem.currency_id,
                util.sqlDate(new Date())
              );  

            row.housing = exchange.convertir(
              row.housing,
              session.loading_currency_id,
              session.selectedItem.currency_id,
              util.sqlDate(new Date())
            );

            row.employee_inss = exchange.convertir(
              row.employee_inss,
              session.loading_currency_id,
              session.selectedItem.currency_id,
              util.sqlDate(new Date())
            ); 

            row.enterprise_inss = exchange.convertir(
              row.enterprise_inss,
              session.loading_currency_id,
              session.selectedItem.currency_id,
              util.sqlDate(new Date())
            );             
          });
        }     
    }, true);

    $scope.setCashAccount = setCashAccount;  
    $scope.initialiseEmployee = initialiseEmployee; 
    $scope.formatPeriod = formatPeriod;
    $scope.setConfiguration = setConfiguration;
    $scope.reconfigure = reconfigure;
  }
]);