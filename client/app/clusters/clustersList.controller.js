'use strict';

// --- pending ---
// placement of view all?
// add color coding of tags in class filter collection
// add metadata fields (starting with description) after persistent stores working for primary use cases
// add tooltips
// add hot keys

// --- done ---
// inline class tag entry added, eliminating use of prompt dialog
// check all/none restyled
// moved and restyled the trash and tag icons
// further html and css cleanup

// code cleanup and commenting
// all styles moved to clusters.scss
// class table height is responsive (and non-clipping for classes table)
// added filteredClasses() to match behavior of filteredUtterances()
// check all | none added back in
// replace xeditable with own in-place editing triggered by click on edit icon
// added click to select with styling (separating checked from selected)
// alerts, confirms, and prompts replaced with ngDialogs
// class and text search improved (but probably want to add partial string etc.)
// cross browser clean up
// csv export format created and not tied to training data restrictions
// add additional integrity checks (avoid duplicate texts, prevent texts > 1024, prevent tokens > 45 characters, others?
// add scrolling panes, revisit meaning of class and utterance search once scrolling added
// added file picker for import
// support in-place label editing
// add sorting of classes and utterances

angular.module('ibmwatsonQaGroundtruthUiApp')
    .controller('ClustersListCtrl', ['$scope', '$http', 'ngDialog', 'classes', 'texts', 'nlc',
        function ($scope, $http, ngDialog, classes, texts, nlc) {
            $scope.sequenceNumber = 0;

            // class related elements
            $scope.classes = [];
            // TODO: GET all current classes for tenant
            classes.query({}, function query (err, data) {
                data.forEach( function forEach (element) {
                    element.$$hashKey = data.id;
                    element.seq = $scope.sequenceNumber++;
                    element.label = element.name;
                    element.edit = false;
                    element.checked = false;
                    element.selected = false;
                });
                $scope.classes = data;
            });
            $scope.newClassString = '';
            $scope.selectedClass = [];
            $scope.classOrderOptions = [
                {label : 'Newest First', value : 'newest'},
                {label : 'Oldest First', value : 'oldest'},
                {label : 'Alphabetical', value : 'alpha'},
                {label : 'Most Texts', value : 'most'},
                {label : 'Fewest Texts', value : 'fewest'}
            ];
            $scope.classOrderOption = $scope.classOrderOptions[0];

            // utterance related elements
            $scope.utterances = [];

            texts.query({}, function (err, data) {
                if (err) {
                    console.log('error getting texts: ' + err);
                    return;
                }
                data.forEach( function forEach (element) {
                    element.$$hashKey = data.id;
                    element.seq = $scope.sequenceNumber++;
                    element.label = element.value;
                    if (element.classes !== undefined) {
                        for (var i = 0, len = element.classes.length; i < len; i++) {
                            var classObject = $scope.getFromId($scope.classes, element.classes[i]);
                            if (classObject !== undefined) {
                                element.classes[i] = classObject.label;
                            }
                        }
                    } else {
                        element.classes = [];
                    }
                    element.classes = element.classes || [];
                    element.edit = false;
                    element.checked = false;
                    element.selected = false;
                });
                $scope.utterances = data;
            });

            $scope.newUtteranceString = '';
            $scope.newTagStrings = [];
            $scope.utteranceOrderOptions = [
                {label : 'Newest First', value : 'newest'},
                {label : 'Oldest First', value : 'oldest'},
                {label : 'Alphabetical', value : 'alpha'},
                {label : 'Most Classes', value : 'most'},
                {label : 'Fewest Classes', value : 'fewest'}
            ];
            $scope.utteranceOrderOption = $scope.utteranceOrderOptions[0];
            $scope.utteranceTextFieldVisble = false;

            // ngDialog data
            $scope.promptDialog = {response: ''};

            $scope.showDebugInfo = false;

            $scope.$on('appAction', function (event, args) {
                var name = args.name, data = args.data;
                switch (name) {
                    case 'import':
                        $scope.classOrderOption = $scope.classOrderOptions[2];  // alpha
                        $scope.utteranceOrderOption = $scope.utteranceOrderOptions[2];  // alpha
                        $scope.importFile(data);
                        break;
                    case 'export':
                        $scope.exportToFile();
                        break;
                    case 'train':
                        $scope.train();
                        break;
                    default:
                        ngDialog.open({
                            template: $scope.inform(name + ' not yet handled by clusterListController'),
                            plain: true
                        });
                }
            });

            // ---------------------------------------------------------------------------------------------
            //
            // ------------------------------------ array sets/gets ----------------------------------------
            //
            // ---------------------------------------------------------------------------------------------

            // set ['checked'] to true for all objects in an array
            $scope.checkAll = function(array, bool) {
                array.forEach(function(d){
                    d.checked = bool;
                });
            };

            // return an array of 'checked' objects
            $scope.getChecked = function (array) {
                return _.filter(array, function(d) {
                    return d.checked;
                });
            };

            // return an array of selected classes
            $scope.getSelected = function () {
                return _.filter($scope.classes, function(c) {
                    return c.selected;
                });
            };

            // return a class or utterance with a given label
            $scope.getFromLabel = function(array, label) {
                var idx = -1;
                array.some(function find (element, index) {
                    if (element.label === label) {
                        idx = index;
                        return true;
                    }
                });
                return idx < 0 ? null : array[idx];
            };

            // return a class or utterance with a given id
            $scope.getFromId = function(array, id) {
                var idx = -1;
                array.some(function find (element, index) {
                    if (element.id === id) {
                        idx = index;
                        return true;
                    }
                });
                return idx < 0 ? null : array[idx];
            };

            // determine if the array contains the label
            $scope.containsLabel = function containsLabel (array, label) {
                return array.some(function find (element) {
                    return element.label === label;
                });
            };

            $scope.getScopeArray = function(type) {
                switch(type) {
                    case 'class':
                        return $scope.classes;
                    case 'utterance':
                        return $scope.utterances;
                }
            };

            // ---------------------------------------------------------------------------------------------
            //
            // ----------------------------------- classes & utterances ------------------------------------
            //
            // ---------------------------------------------------------------------------------------------

            // set function for the variable controlling the list's sort
            $scope.setClassOrderOption = function (option) {
                // needs wrapping inside a $scope function to be accessible in HTML
                $scope.classOrderOption = option;
            };

            // a switch to determine the value used for the list's sort
            $scope.classOrder = function (aClass) {
                switch ($scope.classOrderOption.value) {
                    case 'newest':
                        return -aClass.seq;
                    case 'oldest':
                        return aClass.seq;
                    case 'alpha':
                        return aClass.label;
                    case 'most':
                        return -$scope.numberUtterancesInClass(aClass);
                    case 'fewest':
                        return $scope.numberUtterancesInClass(aClass);
                    default:
                        return -aClass.seq;
                }
            };

            // set function for the variable controlling the list's sort
            $scope.setUtteranceOrderOption = function (option){
                // needs wrapping inside a $scope function to be accessible in HTML
                $scope.utteranceOrderOption = option;
            };

            // a switch to determine the value used for the list's sort
            $scope.utteranceOrder = function (anUtterance) {
                switch ($scope.utteranceOrderOption.value) {
                    case 'newest':
                        return -anUtterance.seq;
                    case 'oldest':
                        return anUtterance.seq;
                    case 'alpha':
                        return anUtterance.label;
                    case 'most':
                        return -$scope.classesForUtterance(anUtterance).length;
                    case 'fewest':
                        return $scope.classesForUtterance(anUtterance).length;
                    default:
                        return -anUtterance.seq;
                }
            };

            // ---------------------------------------------------------------------------------------------

            // toggle visibility of new class text field
            $scope.toggleClassTextField = function () {
                $scope.classTextFieldVisible = !$scope.classTextFieldVisible;
            };

            // toggle visibility of new utterance text field
            $scope.toggleUtteranceTextField = function () {
                $scope.utteranceTextFieldVisible = !$scope.utteranceTextFieldVisible;
            };

            // ---------------------------------------------------------------------------------------------

            // handle a click on a class row in the classes table
            $scope.selectClass = function (aClass) {
                if (!aClass.edit) {
                    aClass.selected = !aClass.selected;
                }
            };

            // ---------------------------------------------------------------------------------------------

            // toggle 'edit' attribute of <classOrUtterance>
            $scope.editField = function (classOrUtterance) {
                if (!classOrUtterance.edit) {
                    classOrUtterance.edit = true;
                }
                else {
                    $scope.dismissEditField(classOrUtterance);
                }
            };

            // ---------------------------------------------------------------------------------------------

            // set the edit attibute of a given object to false. Used for toggline edit-mode for classes and utterances
            $scope.dismissEditField = function(classOrUtterance) {
                var field;
                field = window.document.getElementById(classOrUtterance.$$hashKey);
                field.value = classOrUtterance.label;
                classOrUtterance.edit = false;
            };

            // ---------------------------------------------------------------------------------------------

            // check the keyup event to see if the user has pressed 'esc' key. If so, dismiss the editing field
            $scope.keyUpCancelEditing = function(classOrUtterance, event) {
                if (event.keyCode === 27) {
                    $scope.dismissEditField(classOrUtterance);
                }
            };

            // ---------------------------------------------------------------------------------------------

            $scope.changeLabel = function(type, object) {
                var msg, oldLabel = object.label, field, newLabel;
                field = window.document.getElementById(object.$$hashKey);
                newLabel = field.value;
                if (newLabel === '' || newLabel === oldLabel) {
                    field.value = oldLabel;  // required so that empty value doesn't stick in text field
                    object.edit = false;
                } else {
                    var allObjects = $scope.getScopeArray(type);
                    if ($scope.containsLabel(allObjects, newLabel)) {
                        msg = $scope.inform('The ' + type + ' "' + newLabel + '" already exists.');
                        ngDialog.open({template: msg, plain: true});
                    } else {
                        object.edit = false;  // turn editing back off before saving state
                        object.label = newLabel;
                        field.value = newLabel;
                        switch (type) {
                            case 'class':
                                $scope.classLabelChanged(object, oldLabel, newLabel);
                                break;
                            case 'utterance':
                                $scope.textLabelChanged(object, oldLabel, newLabel);
                                break;
                        }
                    }
                }
            };

            // ---------------------------------------------------------------------------------------------

            // propagate label <newLabel> to all utterances tagged with label <oldLabel>
            $scope.classLabelChanged = function (object, oldLabel, newLabel) {
                var i, index;
                for (i = 0; i < $scope.utterances.length; i++) {
                    index = $scope.utterances[i].classes.indexOf(oldLabel);
                    if (index >= 0) {
                        $scope.utterances[i].classes[index] = newLabel;
                    }
                }
                // TODO: PUT - change class name
                classes.update(object.id, { value: newLabel }, function (err, data) {
                    if (err) {
                        console.log('error changing class label');
                    } else {
                        console.log('success changing class label: ' + data);
                    }
                });
            };

            // persist the change to the text label
            $scope.textLabelChanged = function (object, oldLabel, newLabel) {
                // TODO: PUT - change text
                texts.update(object.id, { value: newLabel }, function (err, data) {
                    if (err) {
                        console.log('error changing text label');
                    } else {
                        console.log('success changing text label: ' + data);
                    }
                });
            };

            // ---------------------------------------------------------------------------------------------

            // Counts the number of utterances that have a given <aClass> tagged
            $scope.numberUtterancesInClass = function (aClass) {
                var i, n = 0;
                for (i = 0; i < $scope.utterances.length; i += 1) {
                    if ($scope.utterances[i].classes.indexOf(aClass.label) >= 0) {
                        n++;
                    }
                }
                return n;
            };

            // ------------------------------------------------------------------------------------------------

            // return all classes tagged in utterance <anUtterance>
            $scope.classesForUtterance = function (anUtterance) {
                var i, classes = [];
                for (i = 0; i < anUtterance.classes.length; i++) {
                    classes.push($scope.getFromLabel($scope.classes, anUtterance.classes[i]));
                }
                return classes;
            };

            // ---------------------------------------------------------------------------------------------

            $scope.add = function (type, label, callback) {
                var existingObject, msg;
                if (!label) {
                    return;
                }
                // if an object already exists with this label
                existingObject = $scope.getFromLabel($scope.getScopeArray(type), label);
                if (existingObject) {
                    $scope.newClassString = '';
                    $scope.newUtteranceString = '';
                    msg = $scope.inform('The ' + type + ' "' + existingObject.label + '" already exists.');
                    ngDialog.open({template: msg, plain: true});
                } else {
                    var id = '';
                    switch (type) {
                        case 'class' :
                            return classes.post({ name : label }, function post (err, data) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    id = data.id;
                                    var newClass = {'$$hashKey' : id, 'id' : id, 'seq' : $scope.sequenceNumber++, 'label' : label, 'edit' : false, 'checked' : false, 'selected': false};
                                    $scope.classes.push(newClass);
                                    $scope.newClassString = '';
                                    callback(null, newClass);
                                }
                            });
                        case 'utterance' :
                            return texts.post({ value : label }, function post (err, data) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    id = data.id;
                                    var newUtterance = {'$$hashKey' : id, 'id' : id, 'seq' : $scope.sequenceNumber++, 'label' : label, 'classes' : [], 'edit': false, 'checked' : false, 'beingTagged': false};
                                    $scope.tagUtterances([newUtterance], $scope.getSelected());
                                    $scope.utterances.push(newUtterance);
                                    $scope.newUtteranceString = '';
                                    callback(null, newUtterance);
                                }
                            });
                    }
                }

            };

            // ---------------------------------------------------------------------------------------------

            // prepare to delete class <aClass> if operation is confirmed
            $scope.deleteClass = function (aClass) {
                var msg;
                if ($scope.numberUtterancesInClass(aClass) === 0) {
                    msg = $scope.question('Delete class "' + aClass.label + '"?');
                } else {
                    msg = $scope.question('One or more text strings have been classified with "'  + aClass.label + '". Delete this class anyway?');
                }
                ngDialog.openConfirm({template: msg, plain: true
                }).then(function() {  // ok
                    $scope.deleteClasses([aClass]);
                });
            };

            // prepare to delete utterance <anUtterance> if operation is confirmed
            $scope.deleteUtterance = function (anUtterance) {
                var msg;
                msg = $scope.question('Delete this text?');
                ngDialog.openConfirm({template: msg, plain: true
                }).then(function() {  // ok
                    $scope.deleteUtterances([anUtterance]);
                });
            };

            // ---------------------------------------------------------------------------------------------

            // prepare to delete all currently checked classes if operation is confirmed
            $scope.deleteCheckedClasses = function () {
                var msg;
                msg = $scope.question('Delete checked classes?');
                ngDialog.openConfirm({template: msg, plain: true
                }).then(function() {  // ok
                    $scope.deleteClasses($scope.getChecked($scope.classes));
                });
            };

            // prepare to delete all currently checked utterances if operation is confirmed
            $scope.deleteCheckedUtterances = function () {
                var msg, i, utterancesToDelete = [];
                msg = $scope.question('Delete checked texts?');
                ngDialog.openConfirm({template: msg, plain: true
                }).then(function() {  // ok
                    for (i = 0; i < $scope.utterances.length; i++) {
                        if ($scope.utterances[i].checked) {
                            $scope.utterances[i].checked = false;
                            utterancesToDelete.push($scope.utterances[i]);
                        }
                    }
                    $scope.deleteUtterances(utterancesToDelete);
                });
            };

            // ---------------------------------------------------------------------------------------------

            // delete all class in <classArray>
            $scope.deleteClasses = function (classArray) {
                var i, j, classLength, utteranceLength, index;
                for (i = 0, classLength = classArray.length; i < classLength; i++) {
                    for (j = 0, utteranceLength = $scope.utterances.length; j < utteranceLength; j++) {
                        index = $scope.utterances[j].classes.indexOf(classArray[i].label);
                        if (index >= 0) {
                            $scope.utterances[j].classes.splice(index, 1);
                        }
                    }
                    var clazz = classArray[i];
                    index = $scope.classes.indexOf(clazz);
                    $scope.classes.splice(index, 1);
                    $scope.removeClass(clazz.id);
                }
            };

            // removes a class from the database with the given id
            $scope.removeClass = function (id) {
                classes.remove(id, function remove (err, data) {
                    if (err) {
                        console.log('failed delete: ' + err);
                    } else {
                        console.log('successful delete: ' + data);
                    }
                });
            };

            // delete all utterances in <utteranceArray>
            $scope.deleteUtterances = function (utteranceArray) {
                var i, index;
                for (i = 0; i < utteranceArray.length; i++) {
                    var text = utteranceArray[i];
                    index = $scope.utterances.indexOf(text);
                    $scope.utterances.splice(index, 1);
                    $scope.removeText(text.id);
                }
            };

            $scope.removeText = function (id) {
                // TODO: DELETE - text
                texts.remove(id, function remove (err, data) {
                    if (err) {
                        console.log('failed delete: ' + err);
                    } else {
                        console.log('successful delete: ' + data);
                    }
                });
            };

            // ---------------------------------------------------------------------------------------------

            // return array of classes filtered by label substring match with classFilter field
            // (this matches interactive behavior of utterance filter so not just based on leading characters e.g.)
            $scope.filteredClasses = function () {
                var i, results = [];
                if (!$scope.classFilter) {
                    return $scope.classes;
                }
                for (i = 0; i < $scope.classes.length; i++) {
                    if ($scope.classes[i].label.toLowerCase().indexOf($scope.classFilter.toLowerCase()) >= 0) {
                        results.push($scope.classes[i]);
                    }
                }
                return results;
            };

            // return array of utterances filtered by class inclusion and further filtered by label substring match with utteranceFilter field
            $scope.filteredUtterances = function () {
                var i, j, selectedClasses = $scope.getSelected(), firstFilteredResults = [], results = [];
                if (selectedClasses.length === 0) {
                    // no class filters present
                    firstFilteredResults = $scope.utterances;
                }
                else {
                    // filter first by class inclusion
                    for (i = 0; i < $scope.utterances.length; i++) {
                        for (j = 0; j < selectedClasses.length; j++) {
                            if ($scope.utterances[i].classes.indexOf(selectedClasses[j].label) >= 0) {
                                firstFilteredResults.push($scope.utterances[i]);
                                break;
                            }
                        }
                    }
                }
                // filter further by utteranceFilter string if not empty
                if ($scope.utteranceFilter) {
                    for (i = 0; i < firstFilteredResults.length; i++) {
                        if (firstFilteredResults[i].label.toLowerCase().indexOf($scope.utteranceFilter.toLowerCase()) >= 0) {
                            results.push(firstFilteredResults[i]);
                        }
                    }
                }
                else {
                    results = firstFilteredResults;
                }
                return results;
            };

            // ---------------------------------------------------------------------------------------------

            // uncheck class <aClass> removing it from the collection of class filters for the utterances list
            $scope.removeClassFromView = function (aClass) {
                aClass.selected = false;
            };

            // -------------------------------------------------------------------------------------------------
            //
            // --------------------- tagging (associating utterance with class or classes) ---------------------
            //
            // -------------------------------------------------------------------------------------------------

            // return boolean indicating whether utterance <anUtterance> has any class tags
            $scope.isTagged = function (anUtterance) {
                return anUtterance.classes.length > 0;
            };

            // remove class tag with label <label> from utterance <anUtterance> if confirmed
            $scope.removeTag = function (anUtterance, label) {
                var msg;
                if (anUtterance.classes.indexOf(label) >= 0) {
                    msg = $scope.question('Remove class "' + label + '" from this text?');
                    ngDialog.openConfirm({template: msg, plain: true
                    }).then(function() {  // ok
                        anUtterance.classes = anUtterance.classes.filter($scope.doesNotMatch(label));
                        var clazz = $scope.getFromLabel($scope.classes, label);
                        // TODO: remove class from text
                        texts.removeClasses(anUtterance.id, [{id: clazz.id}], function (err, data) {
                            if (err) {
                                console.log('failed delete of class from text');
                            } else {
                                console.log('successful delete of class from text: ' + data);
                            }
                        });
                    });
                } else {
                    msg = $scope.inform('This text is not classified with class "' + label + '".');
                    ngDialog.openConfirm({template: msg, plain: true});
                }
            };

            // mark utterance <anUtterance> as being tagged or dismiss tag field if already being tagged
            $scope.beginTaggingUtterance = function (anUtterance) {
                //var field;
                if (!anUtterance.beingTagged) {
                    $scope.newTagStrings[anUtterance.$$hashKey] = '';
                    anUtterance.beingTagged = true;
                }
                else {
                    anUtterance.beingTagged = false;
                }
            };

            // handle keyup events from new tag field
            $scope.newTagFieldKeyUp = function (event, anUtterance) {
                var keyCode = event.keyCode, tagString;
                switch (keyCode) {
                    case 13:
                        tagString = $scope.newTagStrings[anUtterance.$$hashKey];
                        $scope.newTagStrings[anUtterance.$$hashKey] = '';
                        anUtterance.beingTagged = false;
                        $scope.tagUtterance(tagString, anUtterance);
                        break;
                    case 27:
                        $scope.newTagStrings[anUtterance.$$hashKey] = '';
                        anUtterance.beingTagged = false;
                        break;
                }
            };

            // add a class tag with label <classLabel> to utterance <anUtterance>
            $scope.tagUtterance = function (classLabel, anUtterance) {
                var i, msg, classObj;
                if (classLabel) {
                    classObj = $scope.getFromLabel($scope.classes, classLabel);
                    if (!classObj) {
                        msg = $scope.question('The class "' + classLabel + '" has not been created. Create it now?');
                        ngDialog.openConfirm({template: msg, plain: true
                        }).then(function() {  // ok
                            $scope.add('class', classLabel, function (err, classObj) {
                                if (err) {
                                    console.log(err);
                                    return;
                                } else if (classObj !== undefined) {
                                    $scope.tagUtterances([anUtterance], [classObj]);
                                }
                            });
                        });
                    }
                    else {
                        for (i = 0; i < anUtterance.classes.length; i++) {
                            if (anUtterance.classes[i].toLowerCase() === classLabel.toLowerCase()) {
                                msg = $scope.inform('This text has already been tagged with "' + anUtterance.classes[i] + '".');
                                ngDialog.openConfirm({template: msg, plain: true});
                                return;
                            }
                        }
                        $scope.tagUtterances([anUtterance], [classObj]);
                    }
                }
            };

            // prepare to add class tags for all checked classes to all checked utterances
            $scope.tagCheckedUtterances = function () {
                var msg;
                if (!$scope.getChecked($scope.classes).length) {
                    msg = $scope.inform('Please select one or more classes first');
                    ngDialog.openConfirm({template: msg, plain: true});
                }
                $scope.tagUtterances($scope.getChecked($scope.utterances), $scope.getChecked($scope.classes));
            };

            // add class tags in array <classesArray> to all utterances in array <utterancesArray>
            $scope.tagUtterances = function (utterancesArray, classesArray) {
                var i, j;
                var textsLength = utterancesArray.length;
                var classesLength = classesArray.length;
                var classIds;
                for (i = 0; i < textsLength; i++) {
                    classIds = [];
                    for (j = 0; j < classesLength; j++) {
                        if (utterancesArray[i].classes.indexOf(classesArray[j].label) < 0) {
                            utterancesArray[i].classes.push(classesArray[j].label);
                            classIds.push({ id : classesArray[j].id });
                        }
                    }
                    if (classIds.length > 0) {
                        $scope.addClassToText(utterancesArray[i].id, classIds);
                    }
                }
            };

            $scope.addClassToText = function (id, classIds) {
                // TODO PATCH - adding class to text
                texts.addClasses(id, classIds, function (err, data) {
                    if (err) {
                        console.log('error while adding classes');
                    } else {
                        console.log('successful add class ' + data);
                    }
                });
            };

            // -------------------------------------------------------------------------------------------------
            //
            // --------------------------------------- dialog functions ----------------------------------------
            //
            // -------------------------------------------------------------------------------------------------

            // construct html for ngDialog used to inform string <aString>
            $scope.inform = function (aString) {
                var contents;
                contents = '<div>' + aString + '</div>';
                contents += '<br>';
                contents += '<form class="ngdialog-buttons">';
                contents += '<input type="submit" value="OK" class="ngdialog-button ngdialog-button-primary" ng-click="closeThisDialog(' + 'Cancel' + ')">';
                contents += '</form>';
                return contents;
            };

            // construct html for ngDialog used to ask question in string <aString>
            $scope.question = function (aString) {
                var contents;
                contents = '<div>' + aString + '</div>';
                contents += '<br>';
                contents += '<form class="ngdialog-buttons" ng-submit="confirm(' + 'OK' + ')">';
                contents += '<input type="submit" value="OK" class="ngdialog-button ngdialog-button-primary" ng-click="confirm(' + 'OK' + ')">';
                contents += '<input type="button" value="Cancel" class="ngdialog-button ngdialog-button-secondary" ng-click="closeThisDialog(' + 'Cancel' + ')">';
                contents += '</form>';
                return contents;
            };

            // -------------------------------------------------------------------------------------------------
            //
            // --------------------------------------- general functions ---------------------------------------
            //
            // -------------------------------------------------------------------------------------------------

            // return all elements in array that do not match string <aString>
            $scope.doesNotMatch = function (aString) {
                return function (element) {
                    return element !== aString;
                };
            };

            // -------------------------------------------------------------------------------------------------
            //
            // --------------------------------------- API/Service functions -----------------------------------
            //
            // -------------------------------------------------------------------------------------------------

            $scope.train = function () {
                var i, j, msg, stringFragment, tokens, utterance;
                // validation - should this be server side, or at least a part of the service?
                for (i = 0; i < $scope.utterances.length; i++) {
                    if ($scope.utterances[i].classes.length === 0) {
                        msg = $scope.inform('"' + $scope.utterances[i].label + '" is not classified. Please add class or remove it before starting training.');
                        ngDialog.open({template: msg, plain: true});
                        return;
                    }
                    if ($scope.utterances[i].label.length > 1024) {
                        stringFragment = $scope.utterances[i].label.substring(0, 60) + ' ...';
                        msg = $scope.inform('"' + stringFragment + '" is longer than 1024 characters. Please shorten or remove it before starting training.');
                        ngDialog.open({template: msg, plain: true});
                        return;
                    }
                    tokens = $scope.utterances[i].label.split(' ');
                    for (j = 0; j < tokens.length; j += 1) {
                        if (tokens[j].length > 45) {
                            msg = $scope.inform('"' + tokens[j] + '" in text "' + $scope.utterances[i].label + '" is longer than 45 characters. Please change this before starting training.');
                            ngDialog.open({template: msg, plain: true});
                            return;
                        }
                    }
                }
                // create training data
                var trainingData = [];
                for (i = 0; i < $scope.utterances.length; i++) {
                    utterance = $scope.utterances[i];
                    trainingData.push({
                        text : utterance.label,
                        classes : utterance.classes
                    });
                }
                // send to NLC service
                nlc.train(trainingData);
            };

            $scope.exportToFile = function () {
                nlc.download($scope.utterances, $scope.classes);
            };

            $scope.addClass = function addClass (label) {
                $scope.add('class', label, function (err, data) {
                    if (err) {
                        console.log('error: ' + err);
                        return null;
                    } else {
                        return data;
                    }
                });
            };

            $scope.addUtterance = function addUtterance (label, classes) {
                $scope.add('utterance', label, function (err, data) {
                    if (err) {
                        console.log('error: ' + err);
                        return null;
                    } else {
                        data.classes = classes;
                        // TODO: make tagUtterance
                        return data;
                    }
                });
            };

            $scope.importFile = function (fileContent) {
                nlc.upload(fileContent).then(function(data) {
                    console.log('import: ' + JSON.stringify(data));
                    for (var i = 0, len = data.classes.length; i < len; i++) {
                        if (!$scope.containsLabel($scope.classes, data.classes[i])) {
                            $scope.addClass(data.classes[i]);
                        }
                    }

                    for (i = 0, len = data.text.length; i < len; i++) {
                        var text = $scope.getFromLabel($scope.utterances, data.text[i].text);
                        if (text === null) {
                            $scope.addUtterance(data.text[i].text, data.text[i].classes);
                        } else {
                            text.classes = data.text[i].classes;
                            // TODO: tagUtterance
                        }
                    }
                });
            };
        }
    ]);