$(document).ready(function() {
    let API_URL = ""
    fetchMode(function(error,mode){
        if(mode != 'local'){
            API_URL = "https://lamix.hatoltd.com"
        }
        fetchUser(function(error, user){
        // Now you can use the userID variable or id parameter here
        const chatId = getIdFromUrl(window.location.href) || $(`#lamix-chat-widget`).data('id');
        const userId = user._id
        let messagesCount = 0 
        let currentStep = 0;
        let totalSteps = 0;
        let chatData = {};
        let isNew = true;
        let feedback = false
        let thumbnail = false

        sendCustomData({action: 'viewpage'});
        fetchchatData(chatId, userId); // Fetch the initial chat data when the page loads

        
        $('textarea').each(function() {
            resizeTextarea(this);
            $(this).on('input change', function() {
                resizeTextarea(this);
            });
        });

        function resizeTextarea(element){
            element.style.height = 'auto';
            element.style.height = (element.scrollHeight - 20 ) + 'px';  
        }

        $('#reset-chat').click(function(){
            fetchchatData(chatId, userId, true) ;
        })

        $('.user-chat').click(function(){
            const selectUser = $(this).data('user')
            fetchchatData(chatId, selectUser)
        })

        window.choosePath = function(response) {
            currentStep++;
            hideOtherChoice(response,currentStep,function(){
                updatechatContent(response);
            })

            $.ajax({
                url: API_URL+'/api/chat-data',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ currentStep:currentStep-1, message:response, userId, chatId, isNew }),
                success: function(response) {
                    isNew = false
                },
                error: function(error) {
                    console.log(error.statusText);
                }
            });
        };
        window.sendMessage = function(customMessage,displayStatus = true) {
            currentStep ++
            messagesCount ++
            if(messagesCount >= 10){
                Swal.fire({
                    title: '注意',
                    text: '無料ユーザーのメッセージの最大数は1日10件です。',
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                return
            }
            const message = customMessage || $('#userMessage').val();
            if (message.trim() !== '') {
                if(displayStatus){
                    displayMessage('user', message);
                }
                $('#userMessage').val(''); // Clear the input field
                // Send the message to the backend (to be implemented)
                $.ajax({
                    url: API_URL+'/api/chat-data', // Backend endpoint to handle the message
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ currentStep:currentStep-1, message, userId, chatId, isNew }),
                    success: function(response) {
                        const {userId, chatId } = response
                        if(currentStep < totalSteps){
                            displayStep(chatData, currentStep);
                        }else{
                            generateCompletion()
                            isNew = false
                        }
                    },
                    error: function(error) {
                        console.error('Error:', error);
                        displayMessage('bot', 'An error occurred while sending the message.');
                    }
                });
            }
        }
        $(document).on('click','#unlock-result',function(){
            sendCustomData({action:'unlock-result'})
            promptForEmail()
        })
        function fetchchatData(chatId,userId,reset) {
            $('#chatContainer').empty()
            if(reset){
                currentStep = 0
            }
            $.ajax({
                url: API_URL+`/api/chat/`,
                type: 'POST',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify({ userId, chatId }),
                success: function(data) {
                    isNew = reset || data.isNew
                    chatData = data.chat.content;
                    totalSteps = chatData.length;
                    chatName = data.chat.name
                    thumbnail = data.chat.thumbnailUrl
                    $('#chat-title').text(chatName)

                    if(!isNew){
                        displayChat(data.userChat.messages)
                    }

                    if(isNew && chatData.length > 0){
                        displayStep(chatData, currentStep);
                    }

                    if(isNew && chatData.length == 0 ){
                        $.ajax({
                            url: API_URL+'/api/chat-data',
                            type: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            data: JSON.stringify({ currentStep:0, message:'Start the conversation', userId, chatId, isNew }),
                            success: function(response) {
                                isNew = false
                                generateCompletion()
                            },
                            error: function(error) {
                                console.log(error.statusText);
                            }
                        });
                        
                    }

                },
                error: function(xhr, status, error) {
                    console.log(error)

                }
            });
        }
        function displayChat(userChat) {
            let chatContainer = $('#chatContainer');
            chatContainer.empty();
        
            for (let i = 0; i < userChat.length; i++) {
                if (userChat[i].role === "system") {
                    continue;
                }
                
                currentStep = Math.floor(i / 2) + 1;
                let messageHtml = '';
        
                if (userChat[i].role === "assistant") {
                    let assistantMessage = userChat[i];
                    let userMessage = userChat[i + 1];
                    let designStep = currentStep - 1 
                    messageHtml += `
                        <div id="container-${designStep}">
                            <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                                <div id="message-${designStep}" class="p-3 ms-3 text-start" style="border-radius: 15px; background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #e8e8e8 102.92%);">
                                    ${marked.parse(assistantMessage.content)}
                                </div>
                            </div>
                    `;
        
                    if (userMessage && userMessage.role === "user") {
                        messageHtml += `
                            <div class="d-flex flex-row justify-content-end mb-4 message-container">
                                <div id="response-${designStep}" class="p-3 me-3 border" style="border-radius: 15px; background-color: #fbfbfb;">
                                    ${marked.parse(userMessage.content)}
                                </div>
                            </div>
                        </div>
                        `;
                    } else {
                        messageHtml += `
                            <div id="response-${designStep}" class="choice-container"></div>
                        </div>
                        `;
                    }
        
                    chatContainer.append(messageHtml);
                    i++; // Skip the next iteration as we've already handled the user message
                }
            }
        
            if (userChat[userChat.length - 1].role === "user" && userChat[userChat.length - 1].content) {
                if(currentStep < totalSteps){
                    displayStep(chatData, currentStep);
                }else{
                    generateCompletion()
                }
            } else {
                //generateChoice();
            }
        }
        
           
        function displayStep(chatData, currentStep) {

            const step = chatData[currentStep];
            $('#chatContainer').append(`
            <div id="container-${currentStep}">
                <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                    <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                    <div id="message-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #e8e8e8 102.92%);"></div>
                </div>
                <div id="response-${currentStep}" class="choice-container" ></div>
            </div>`)
            step.responses.forEach((response, index) => {
                if(response.trim() != '' ){
                    const button = $(`<button class="btn btn-flat-border my-2" onclick="choosePath('${response}')">${response}</button>`);
                    button.css('opacity',0)
                    $(`#response-${currentStep}`).append(button);
                }
            });
            appendHeadlineCharacterByCharacter($(`#message-${currentStep}`), step.question,function(){
                $(`#response-${currentStep} button`).each(function(){
                    $(this).css('opacity',1)
                })
            })
        }

        function updatechatContent(response) {
            const previousStep = chatData[currentStep-1]; // Previous step where the choice was made


            if (currentStep < totalSteps) {
                $('#chatContainer').append(`
                <div id="container-${currentStep}">
                    <div class="d-flex flex-row justify-content-start mb-4 message-container" style="opacity:0;">
                        <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                        <div id="message-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #e8e8e8 102.92%);"></div>
                    </div>
                    <div id="response-${currentStep}" class="choice-container" ></div>
                </div>`)
                const nextStep = chatData[currentStep];
                nextStep.responses.forEach(response => {
                    if(response.trim() != ''){
                        const button = $(`<button class="btn btn-flat-border my-2" onclick="choosePath('${response}')">${response}</button>`)
                        button.css('opacity',0)
                        $(`#response-${currentStep}`).append(button);
                    }
                });

                const choice = previousStep.responses.find(c => c === response);
                $(`#message-${currentStep}`).closest('.message-container').animate({ opacity: 1 }, 500, function() { 
                    appendHeadlineCharacterByCharacter($(`#message-${currentStep}`), nextStep.question,function(){
                        $(`#response-${currentStep} button`).each(function(){
                            $(this).css('opacity',1)
                        })
                    });
                })
            }else{
                generateCompletion()
            }
        }

        function hideOtherChoice(response, currentStep, callback) {

            $(`#response-${currentStep - 1} button`).each(function() {
                const currentChoice = $(this).text()
                if(response == currentChoice){
                    const response = $(this).text()
                    $(`#response-${currentStep - 1}`).remove()
                    $(`#container-${currentStep - 1}`).append(`
                        <div class="d-flex flex-row justify-content-end mb-4 message-container" style="opacity:0;">
                            <div id="response-${currentStep - 1}" class="p-3 me-3 border" style="border-radius: 15px; background-color: #fbfbfb;">${response}</div>
                        </div>
                    `)
                }
                $(this).remove()
            });
            $(`#response-${currentStep - 1}`).closest('.message-container').animate({ opacity: 1 }, 1000,function(){
                if (callback) {callback()}
            })
        }

        function generateChoice(){
            const apiUrl = API_URL+'/api/openai-chat-choice/'

            $.ajax({
                url: apiUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ userId, chatId }),
                success: function(response) {
                    const cleanResponse = cleanJsonArray(response)

                    cleanResponse.forEach(choice => {
                        const button = $(`<button class="btn btn-flat-border my-2" onclick="sendMessage('${choice}')">${choice}</button>`)
                        $(`#response-${currentStep}`).append(button);
                    });
                },
                error: function(error) {
                    console.error('Error:', error);
                }
            });
        }
        function cleanJsonArray(jsonString) {
            // Remove all characters before the first '{'
            let start = jsonString.indexOf('[');
            if (start !== -1) {
                jsonString = jsonString.substring(start);
            }

            // Remove all characters after the last '}'
            let end = jsonString.lastIndexOf(']');
            if (end !== -1) {
                jsonString = jsonString.substring(0, end + 1);
            }

            return JSON.parse(jsonString);
        }
        
        function generateCompletion(){
            
            const apiUrl = API_URL+'/api/openai-chat-completion';
  
            $.ajax({
                url: apiUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ userId, chatId }),
                success: function(response) {
                    const sessionId = response.sessionId;
                    const streamUrl = API_URL+`/api/openai-chat-completion-stream/${sessionId}`;
                    const eventSource = new EventSource(streamUrl);
                    let markdownContent = "";

                    hideOtherChoice(false, currentStep)
                    // Initialize the bot response container
                    const botResponseContainer = $(`
                        <div id="container-${currentStep}">
                            <div class="d-flex flex-row justify-content-start mb-4 message-container">
                                <img src="${ thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp' }" alt="avatar 1" class="rounded-circle" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;">
                                <div id="completion-${currentStep}" class="p-3 ms-3 text-start" style="border-radius: 15px;   background: linear-gradient(90.9deg, rgba(247, 243, 255, 0.5) 2.74%, #e8e8e8 102.92%);"></div>
                            </div>
                            <div id="response-${currentStep}" class="choice-container" ></div>
                        </div>`);
                    $('#chatContainer').append(botResponseContainer);
                    $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);
                    

                    eventSource.onmessage = function(event) {
                        const data = JSON.parse(event.data);
                        markdownContent += data.content;
                        $(`#completion-${currentStep}`).html(marked.parse(markdownContent));
                    };

                    eventSource.onerror = function(error) {
                        console.log('EventSource failed.');
                        eventSource.close();
                    };
                },
                error: function(error) {
                    console.error('Error:', error);
                }
            });
        }

        // Event handler for the send button
        $('#sendMessage').on('click', function() {
            sendMessage();
        });

        // Event handler for the Enter key
        $('#userMessage').on('keypress', function(event) {
            if (event.which == 13 && !event.shiftKey) { // Enter key is pressed without Shift
                sendMessage();
            }
        });     

        // Function to display a message in the chat
        function displayMessage(sender, message) {
            const messageClass = sender === 'user' ? 'user-message' : 'bot-message';

            if(messageClass == 'user-message'){
                $('#chatContainer').append(`
                    <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass}">
                        <div  class="p-3 me-3 border" style="border-radius: 15px; background-color: #fbfbfb;">
                            <span>${message}</span>
                        </div>
                    </div>
                `);
            }
            $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight); // Scroll to the bottom
        }
        
        function sendCustomData(customData){
            $.ajax({
                url: API_URL+'/api/custom-data',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ userId, customData: customData }),
                success: function(response) {
                    
                },
                error: function(error) {
                    console.log(error.statusText);
                }
            });
        }
        
        let maxScrollHeight = 0;
        let lastTriggeredHeight = 0;
        const viewportHeight = $(window).height();
        const updateInterval = viewportHeight * 0.05; // 5% of the viewport height

        function maxScroll() {
            const currentScrollHeight = $(window).scrollTop();
            const documentHeight = $(document).height();
            const windowHeight = $(window).height();
            const scrollPercentage = (currentScrollHeight / (documentHeight - windowHeight)) * 100;

            if (currentScrollHeight > maxScrollHeight) {
                maxScrollHeight = currentScrollHeight;
                if (Math.abs(currentScrollHeight - lastTriggeredHeight) >= updateInterval) {
                    sendCustomData({
                        action: 'scroll',
                        value: maxScrollHeight,
                        scrollPercentage: scrollPercentage.toFixed(2)
                    });
                    lastTriggeredHeight = currentScrollHeight;
                }
            }

 
        }

        $(window).on('scroll', function() {
            maxScroll();
        });
    });
    })

    // Fetch the user's IP address and generate a unique ID
   

    function getIdFromUrl(url) {
        // Use a regular expression to capture the ID part from the URL
        var regex = /\/chat\/([a-zA-Z0-9]+)/;
        var match = url.match(regex);
        
        // If a match is found, return the ID, otherwise return null
        if (match && match[1]) {
            return match[1];
        } else {
            return null;
        }
    }
    function fetchUser(callback) {
        $.ajax({
            url: API_URL+'/api/user',
            method: 'GET',
            success: function(response) {
                if (callback && typeof callback === 'function') {
                    callback(null, response.user);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error fetching user:', textStatus, errorThrown);
                if (callback && typeof callback === 'function') {
                    callback(new Error(textStatus + ': ' + errorThrown), null);
                }
            }
        });
    }

    function fetchMode(callback) {
        $.ajax({
            url: '/api/mode',
            method: 'GET',
            success: function(response) {
                if (callback && typeof callback === 'function') {
                    callback(null, response);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                if (callback && typeof callback === 'function') {
                    callback(null,'online');
                }
            }
        });
    }

    function appendHeadlineCharacterByCharacter($element, headline, callback) {
        let index = 0;

        const spinner = $(`<div class="spinner-grow spinner-grow-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>`)
        $element.append(spinner)
        $element.closest(`.message-container`).animate({ opacity: 1 }, 500, function() { 
            $element.addClass('d-flex')
            setTimeout(() => {
                spinner.css('visibility', 'hidden');
                setTimeout(() => {
                    let intervalID = setInterval(function() {
                        if (index < headline.length) {
                            $element.append(headline.charAt(index));
                            index++;
                        } else {
                            clearInterval(intervalID);
                            if (callback) callback();
                        }
                    }, 25);
                }, 100);
            }, 500);
        });


    }

    function clearContentFromEnd($element, callback) {
        $element.html('')
        if (typeof callback === 'function') {
            callback();
        }
        return
        let currentContent = $element.text();

        let clearIntervalID = setInterval(function() {
            if (currentContent.length > 0) {
                currentContent = currentContent.substring(0, currentContent.length - 1);
                $element.text(currentContent);
            } else {
                clearInterval(clearIntervalID);
                if (typeof callback === 'function') {
                    callback();
                }
            }
        }, 25); // This duration can be adjusted as per your requirement
    }
});
