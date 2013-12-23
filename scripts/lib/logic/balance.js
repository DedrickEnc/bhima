// scripts/lib/logic/balance.js
var q = require('q');

// module: TrialBalance 

// Trial Balance executes a series of general error checking
// functions and specific accounting logic before posting
// to the general ledger.  Any lines with dirty/invalid
// rows are retained as errors to be shipped back to the
// client and displayed.
//
// If there are no errors, the module proceeds to post
// rows from the journal into the general ledger.

// TODO: Clean up this code immensely

module.exports = (function (db) {
  'use strict';

  function errorChecking () {
    var errors, queries;

    errors = {
      "account_defined"            : "%number% Invalid Accounts Detected.",
      "account_locked"             : "%number% Locked Accounts Detected.",
      "balance"                    : "Credits and debits do not balance.",
      "fiscal_defined"             : "Invalid Fiscal Year Detected for %number% transaction(s).",
      "period_defined"             : "Invalid Periods Detected for %number% transaction(s).",
      "inventory_purchase_defined" : "Invalid invoice or purchase order number at line %number%.",
      "debitor_creditor_defined"   : "%number% Invalid Debitor/Creditor Groups."
    };

    queries = {
      // are all accounts defined?
      account_defined : "SELECT `posting_journal`.`id` FROM `posting_journal` LEFT JOIN `account` ON `posting_journal`.`account_id`=`account`.`id` WHERE `account`.`id` IS NULL;",
      // are any accounts locked?
      account_locked : "SELECT `posting_journal`.`id` FROM `posting_journal` LEFT JOIN `account` ON  `posting_journal`.`account_id`=`account`.`id` WHERE `account`.`locked`=1;",
      // are all the creditor/debitor groups + accounts defined
      debitor_creditor_defined : "SELECT `posting_journal`.`id` FROM `posting_journal` WHERE NOT EXISTS ((SELECT `creditor`.`id`, `posting_journal`.`deb_cred_id` FROM `creditor`, `posting_journal` WHERE `creditor`.`id`=`posting_journal`.`deb_cred_id`) UNION (SELECT `debitor`.`id`, `posting_journal`.`deb_cred_id` FROM `debitor`, `posting_journal` WHERE `debitor`.`id`=`posting_journal`.`deb_cred_id`));",
      // are all fiscal years defined and not locked?
      fiscal_defined : "SELECT `posting_journal`.`id` FROM `posting_journal` LEFT JOIN `fiscal_year` ON `posting_journal`.`fiscal_year_id`=`fiscal_year`.`id` WHERE `fiscal_year`.`locked`=1;",
      // are all periods defined and not locked?
      period_defined : "SELECT `posting_journal`.`id` FROM `posting_journal` LEFT JOIN `period` ON `posting_journal`.`period_id`=`period`.`id` WHERE `period`.`locked`=1;",
      // do the invoice/purchase orders exist?
      invoice_purchase_defined : "SELECT `posting_journal`.`id` FROM `posting_journal` WHERE NOT EXISTS ((SELECT `purchase`.`id`, `posting_journal`.`inv_po_id` FROM `purchase`, `posting_journal` WHERE `purchase`.`id`=`posting_journal`.`inv_po_id`) UNION (SELECT `sale`.`id`, `posting_journal`.`inv_po_id` FROM `sale`, `posting_journal` WHERE `sale`.`id`=`posting_journal`.`inv_po_id`));",
      // is the posting_journal balanced?
      balance : "SELECT SUM(`posting_journal`.`credit`) AS `credit`, SUM(`posting_journal`.`debit`) AS `debit`, SUM(`posting_journal`.`debit_equiv`) AS `debit_equiv`, SUM(`posting_journal`.`credit_equiv`) AS `credit_equv` FROM `posting_journal`;"
    };

    function account_locked () { 
      var d = q.defer(), error = {};

      db.execute(queries.account_locked, function (err, res) {
        if (res.length) {
          error.message = errors.account_locked.replace('%number%', res.length);
          error.rows = res.map(function (row) { return row.id; });
        }
        return error.message ? d.reject(error) : d.resolve();
      });
      return d.promise;
    }

    function account_defined () {

      var d = q.defer(), error = {};
      db.execute(queries.account_defined, function (err, res) {
        if (res.length) {
          error.message = errors.account_defined.replace('%number%', res.length);
          error.rows = res.map(function (row) { return row.id; });
        }
        return error.message ? d.reject(error) : d.resolve();
      });
      return d.promise;
    }

    function debitor_creditor_defined () {
      var d = q.defer(), error = {};

      db.execute(queries.debitor_creditor_defined, function (err, res) {
        if (res.length) {
          error.message = errors.debitor_creditor_defined.replace('%number%', res.length);
          error.rows = res.map(function (row) { return row.id; });
        }
        return error.message ? d.reject(error) : d.resolve();
      });
      return d.promise;
    }

    function fiscal_defined () {
      var d = q.defer(), error = {};

      db.execute(queries.fiscal_defined, function (err, res) {
        if (res.length) {
          error.message = errors.fiscal_defined.replace('%number%', res.length);
          error.rows = res.map(function (row) { return row.id; });
        }
        return error.message ? d.reject(error) : d.resolve();
      });
      return d.promise;
    }

    function period_defined () {
      var d = q.defer(), error = {};

      db.execute(queries.period_defined, function (err, res) {
        if (res.length) {
          error.message = errors.period_defined.replace('%number%', res.length);
          error.rows = res.map(function (row) { return row.id; });
        }
        return error.message ? d.reject(error) : d.resolve();
      });
      return d.promise;
    }

    function invoice_purchase_defined () {
      var d = q.defer(), error = {};

      db.execute(queries.invoice_purchase_defined, function (err, res) {
        if (res.length) {
          error.message = errors.invoice_purchase_defined.replace('%number%', res.length);
          error.rows = res.map(function (row) { return row.id; });
        }
        return error.message ? d.reject(error) : d.resolve();
      });

      return d.promise;
    }

    function balance () {
      var d = q.defer(), error = {};

      db.execute(queries.balance, function (err, res) {
        if (res.debit !== res.credit) error.message = errors.balance;
        return error.message ? d.reject(error) : d.resolve();
      });

      return d.promise;
    }

    return q.all([
      account_defined(),
      account_locked(),
      invoice_purchase_defined(),
      period_defined(),
      fiscal_defined(),
      balance(),
    ]);

  }

  function trial () {
    var defer = q.defer(),
        sql = {};

    function formatResults (gl, journal) {
      return { credit : gl.credit  + journal.credit, debit : gl.debit + journal.debit };
    }

    sql.gl_balance = "SELECT SUM(`debit`) AS `debit`, SUM(`credit`) AS `credit` FROM `general_ledger`";

    sql.journal_balance = "SELECT SUM(`debit`) AS `debit`, SUM(`credit`) AS `credit` FROM `posting_journal`";

    errorChecking()
    .then(function () {

      db.execute(sql.gl_balance, function (err, res) {
        if (err) defer.reject(err);
        db.execute(sql.journal_balance, function (error, results) {
          if (error) defer.reject(error);
          else {
            // ensure proper formatting
            // TODO: clean up this code
            var gl_after_balance = formatResults(res[0], results[0]);
            var object = {
              gl_balance : res[0],
              gl_after_balance : gl_after_balance,
            };
           defer.resolve(object);
          }
        });
      });
      
    }, function (reason) {
      defer.reject(reason);
    });

    return defer.promise;
  }

  function post () {
    var defer = q.defer(),
        sql = {};
    
    sql.transfer = ["INSERT INTO `general_ledger` (`enterprise_id`, `fiscal_year_id`, `period_id`, `trans_id`, `trans_date`, `doc_num`, `description`, `account_id`, `debit`, `credit`, `debit_equiv`, `credit_equiv`, `currency_id`, `deb_cred_id`, `deb_cred_type`, `inv_po_id`, `comment`, `cost_ctrl_id`, `origin_id`, `user_id`)",
                    "SELECT `enterprise_id`, `fiscal_year_id`, `period_id`, `trans_id`, `trans_date`, `doc_num`, `description`, `account_id`, `debit`, `credit`, `debit_equiv`, `credit_equiv`, `currency_id`, `deb_cred_id`, `deb_cred_type`,`inv_po_id`, `comment`, `cost_ctrl_id`, `origin_id`, `user_id` FROM `posting_journal`;"].join(' ');
    sql.remove = "DELETE FROM `posting_journal`;";

    db.execute(sql.transfer, function(err, res) {
      if (err) defer.reject(err);
      else {
        db.execute(sql.remove, function (error, res) {
          if (err) defer.reject(error);
          defer.resolve(res);
        });
      }
    });
    
    return defer.promise;
  }

  return { trial: trial, post: post };
});

/*
 * test!
var cfg = JSON.parse(fs.readFileSync('scripts/config.json', 'utf8'));
var db = require('./scripts/lib/database/db')(cfg.db);
var balance = require('./scripts/lib/logic/balance')(db);
*/
