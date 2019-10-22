(function (window, document) {
    // 系统默认校验方法 可自定义添加
    var _regex = {

    };

    var _hooks = {
        required: function(field) {
            var value = field.value;
            if ((field.type === 'checkbox') || (field.type === 'radio')) {
                return (field.checked === true);
            }

            return (value !== null && value !== '');
        }
    };
    var _condition = {}

    validator.check = function (form, fields, callback) {
        var self = this;
        if (!form) {
            console.warn('对象缺失');
            return this;
        }

        // 设置默认值
        this._hooks = _hooks;
        this._condition = _condition;
        this.callback = callback || function () {};
        this.form = typeof form === "object" ? form : document.forms[form] || {};
        this.checkData = {}; // 校验数据
        this.errors = [];
        this.fields = {};
        this.handles = {};

        if (this.form.elements) {
            // form形式
            var input = this.form.querySelectorAll('input');
            var textarea = this.form.querySelectorAll('textarea');
            for (var i = 0; i < input.length; i++) {
                this.checkData[attributeValue(input[i], 'name')] = '';
            }

            for (var i = 0; i < textarea.length; i++) {
                this.checkData[attributeValue(input[i], 'name')] = '';
            }
        } else {
           // data形式
            this.checkData = JSON.parse(JSON.stringify(this.form));
        }

        for (var i = 0, fieldLength = fields.length; i < fieldLength; i++) {
            var field = fields[i];
            // 过滤无效校验规则
            if (!field.name) {
                console.warn('配置错误:' + field + '缺少name');
                continue;
            }

            if (!field.rules) {
                console.warn('配置错误：' + field + '缺少rules');
                continue;
            }


            this.fields[field.name] = field;
            this.fields[field.name].type = null; // input类型
            this.fields[field.name].value = null; // input值
            this.fields[field.name].checked = null; // 是否选中
            this.fields[field.name].errors = [];
            this.fields[field.name].is_success = true;
        }

        // 使用 submit 按钮拦截 (这种一定是form形式)
        var _onsubmit = this.form.onsubmit;
        this.form.onsubmit = function() {
            return function(evt) {
                try {
                    return self.submitValidate(evt) && (_onsubmit === undefined || _onsubmit());
                } catch (e) {
                    console.log(e);
                }
            };
        }(this);

        this.submitValidate = function (e) {
            this.errors = [];
            for (var key in this.fields) {
                var field = this.fields[key] || {}, element = this.form[field.name];
                field.errors = [];
                field.is_success = true;
                if (element && element !== undefined) {
                    field.id = attributeValue(element, "id");
                    field.element = element;
                    field.type = element.length > 0 ? element[0].type : element.type;
                    field.value = attributeValue(element, "value");
                    field.checked = attributeValue(element, "checked");
                    _validateField(this, field);
                }
            }

            if (typeof this.callback === "function") {
                this.callback(this, e);
            }

            // 如果有错误，停止submit 提交
            if (this.errors.length > 0) {
                if (e && e.preventDefault) {
                    e.preventDefault();
                } else if (event) {
                    // IE 使用的全局变量
                    event.returnValue = false;
                }
            }
        }

        this.regCallback = function(name, handler) {
            if (name && typeof name === 'string' && handler && typeof handler === 'function') {
                self['_hooks'][name] = handler;
            }

            return this;
        };

        this.regConditional = function(name, conditional) {
            if (name && typeof name === 'string' && conditional && typeof conditional === 'function') {
                self['_condition'][name] = conditional;
            }

            return this;
        };
    };

    function _validateField(that, field) {
        var rules = field.rules,is_require = false;
        for (var i =0; i < rules.length; i++) {
            if (rules[i].rule == 'required') {
                is_require = true;
            }

            if (rules[i].depends) {
                rules[i].depends = typeof rules[i].depends === 'function' ? rules[i].depends(field, that.fields) : that['_condition'][rules[i].depends](field);
            } else {
                rules[i].depends = true;
            }
        }

        for (var i = 0, ruleLength = rules.length; i < ruleLength; i++) {
            var rule = rules[i].type == 'regex' ? [rules[i].rule] : rules[i].rule.split('!');
            if (!is_require && validator.isEmpty(field.value)) {
                break;
            }

            var is_success = true,
                validatorRule = (rule[0] == '') ? rule[1] : rule[0],
                pattern = new RegExp("\\((.| )+?\\)"),
                is_match = validatorRule.match(pattern),
                fieldParam = null;

            if (is_match) {
                fieldParam = is_match[0];
                validatorRule = validatorRule.replace(fieldParam, '');
                fieldParam = fieldParam.slice(1, fieldParam.length - 1);
            }

            if (is_require && !that['_hooks']['required'](field)) {
                that.errors.push(rules[i].msg);
                field.errors.push({rule: rules[i].rule, msg: rules[i].msg});
                break;
            }

            // 校验步骤:
            if (rules[i].depends) {
                if (rules[i].type != 'regex') {
                    // 1、本地规则库或自定义库
                    if (that['_hooks'][validatorRule] && typeof that['_hooks'][validatorRule] == 'function' && validatorRule != 'required') {
                        if (that.form.elements) {
                            if (rule[0] == '') {
                                is_success = fieldParam ? !that['_hooks'][validatorRule](field, formatFieldParam(fieldParam)) : !that['_hooks'][validatorRule](field);
                            } else {
                                is_success = fieldParam ? that['_hooks'][validatorRule](field, formatFieldParam(fieldParam)) : that['_hooks'][validatorRule](field);
                            }
                        }
                    }

                    // 2、先校验validator类里是否有方法匹配
                    if (validator[validatorRule] && typeof validator[validatorRule] == 'function') {
                        if (that.form.elements) {
                            if (rule[0] == '') {
                                is_success = fieldParam ? !validator[validatorRule](field.value, formatFieldParam(fieldParam)) : !validator[validatorRule](field.value);
                            } else {
                                is_success = fieldParam ? validator[validatorRule](field.value, formatFieldParam(fieldParam)) : validator[validatorRule](field.value);
                            }
                        }
                    }

                } else {
                    // 3、如果是自定义正则 则走正则
                    var ruleTest = typeof rules[i].rule == 'string' ? eval(rules[i].rule) : rules[i].rule;
                    is_success = ruleTest.test(field.value);
                }
            }


            if (field.is_success) {
                field.is_success = is_success;
            }

            if (!is_success) {
                that.errors.push(rules[i].msg);
                field.errors.push({rule: rules[i].rule, msg: rules[i].msg});
            }
        }

    }

    function formatFieldParam(param) {
        param = eval("(" + param + ")");
        return param
    }

    function attributeValue(element, attributeName) {
        if (element.length > 0 && (element[0].type === "radio" || element[0].type === "checkbox")) {
            for (var i = 0, elementLength = element.length; i < elementLength; i++) {
                if (element[i].checked) {
                    return element[i][attributeName];
                }
            }

            return;
        }

        return element[attributeName];
    }
})(window, document);