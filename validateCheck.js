(function (window, document) {
    window.validateCheck = function (form, fields, callback) {
        var self = this;
        // 校验的正则规则

        // self.getRule('is_length'); 取规则所在对象
        var _regexp = {

        };

        // 校验规则写这里
        var _hooks = {
            required: function(field) {
                var value = field.value;
                if ((field.type === 'checkbox') || (field.type === 'radio')) {
                    return (field.checked === true);
                }

                return (value !== null && value !== '');
            },
            is_empty: function (field) {
                return validator.isEmpty(field.value);
            },
            confirm: function (field) {
                var rule = self.getRule('confirm');
                var element = self.form[rule.confirm_name];
                var val = attributeValue(element, 'value');
                return val === field.value ? true : false;
            },
            is_length: function (field) {
                var value = field.value, rule = self.getRule('is_length');
                var min = rule.min || 0, max = rule.max || undefined;
                console.log(min, max);
                console.log(validator.isLength(value, {min:min, max: max}));
                return validator.isLength(value, {min:min, max: max})
            },
            is_mobile: function (field) {
                var value = field.value, arr = [];
                var area = field.area || ['zh-cn'];
                for (var i=0;i<area.length;i++) {
                     var a = area[i].split('-');
                    if (a.length == 2) {
                        a = a[0] + '-' + a[1].toUpperCase();
                        arr.push(a);
                    } else {
                        return false;
                    }
                }

                return validator.isMobilePhone(value, arr);
            },
            is_email: function (field) {
                return validator.isEmail(field.value)
            },
            is_ascii: function (field) {
                return validator.isAscii(field.value);
            },
            is_json: function (field) {
                return validator.isJSON(field.value);
            },
            is_ip: function (field) {
                return validator.isIP(field.value);
            }
        };

        if (!form) {
            console.warn('对象缺失');
            return this;
        }

        // 设置默认值
        this._hooks = _hooks;
        this.callback = callback || function () {};
        this.form = typeof form === "object" ? form : document.forms[form] || {};
        this.checkData = {}; // 校验数据
        this.errors = [];
        this.fields = {};
        this.is_success = true;
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
                var field = this.fields[key] || {},
                    element = this.form[field.name];
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
        };
        // 获取规则对象
        this.getRule = function (name = null) {
            var data = {};
            if (name) {
                for (var i in this.fields) {
                    var rules = this.fields[i].rules;
                    for (var k = 0; k < rules.length; k++) {
                        if (rules[k].rule == name) {
                            data = rules[k];
                        }
                    }
                }
            }

            return data;
        }
    };

    function _validateField(that, field) {
        var rules = field.rules,
            is_require = false;
        for (var i = 0; i < rules.length; i++) {
            if (rules[i].rule === 'required') {
                is_require = true;
            }
        }

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i].rule;
            rules[i].condition = rules[i].depends && typeof rules[i].depends === 'function'? rules[i].depends(field, that.fields) : true;
            console.log(rules[i].condition);
            var is_success = true;
            if (!is_require && that['_hooks'].is_empty(field)) {
                break;
            }

            if (is_require && !that['_hooks']['required'](field)) {
                that.errors.push(rules[i].msg);
                that.is_success = false;
                field.errors.push({rule: rules[i].rule, msg: rules[i].msg});
                break;
            }

            // 校验步骤:
            if (rules[i].condition) {
                switch (rule) {
                    case 'regexp':
                        // 如果是正则
                        var ruleTest = typeof rules[i].regexp === 'string' ? eval(rules[i].regexp) : rules[i].regexp;
                        is_success = ruleTest.test(field.value);
                        break;
                    case 'callback':
                        // 如果是自定义规则
                        is_success = rules[i].callback ? rules[i].callback(field, that.fields) : false;
                        break;
                    default:
                        // 本地规则库或自定义库
                        if (that['_hooks'][rule] && typeof that['_hooks'][rule] === 'function' && rule !== 'required') {
                            if (that.form.elements) {
                                is_success = that['_hooks'][rule](field, that.fields);
                            }
                        }

                        break;
                }
            }

            // 已知没错 直到错为止 那整个都是错
            if (field.is_success) {
                field.is_success = is_success;

            }

            // 错的时候记录错的内容
            if (!is_success) {
                that.errors.push(rules[i].msg);
                that.is_success = false;
                field.errors.push({rule: rules[i].rule, msg: rules[i].msg});
            }
        }
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