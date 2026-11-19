document.addEventListener('DOMContentLoaded', () => {
    const chat = document.getElementById('salesChat');
    const launcher = document.getElementById('salesChatLauncher');
    const openButton = document.getElementById('openSalesChat');
    const closeButton = document.getElementById('closeSalesChat');
    const minimizeButton = document.getElementById('minimizeSalesChat');
    const form = document.getElementById('salesRequestForm');
    const formIntro = document.querySelector('.sales-chat__form-intro');
    const errorMessage = document.getElementById('salesChatError');
    const successMessage = document.getElementById('salesChatSuccess');
    const submitButton = form.querySelector('[type="submit"]');

    const setOpen = (isOpen, returnFocus) => {
        chat.classList.toggle('is-open', isOpen);
        chat.setAttribute('aria-hidden', String(!isOpen));
        launcher.setAttribute('aria-expanded', String(isOpen));
        openButton.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
            window.requestAnimationFrame(() => form.querySelector('input:not([name="website"])').focus());
        } else if (returnFocus) {
            returnFocus.focus();
        }
    };

    launcher.addEventListener('click', () => setOpen(true, launcher));
    openButton.addEventListener('click', () => setOpen(true, openButton));
    closeButton.addEventListener('click', () => setOpen(false, launcher));
    minimizeButton.addEventListener('click', () => setOpen(false, launcher));

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && chat.classList.contains('is-open')) {
            setOpen(false, launcher);
        }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        errorMessage.hidden = true;

        if (!form.reportValidity()) {
            return;
        }

        submitButton.disabled = true;
        submitButton.querySelector('span').textContent = 'Enviando solicitação...';

        try {
            const response = await fetch('/api/send-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.ok !== true) {
                throw new Error(result.message || 'Não foi possível enviar sua solicitação agora. Tente novamente.');
            }

            form.hidden = true;
            formIntro.hidden = true;
            successMessage.hidden = false;
        } catch (error) {
            errorMessage.textContent = error.message || 'Falha de conexão. Verifique sua internet e tente novamente.';
            errorMessage.hidden = false;
        } finally {
            submitButton.disabled = false;
            submitButton.querySelector('span').textContent = 'Enviar solicitação para a Transcarapia';
        }
    });
});
