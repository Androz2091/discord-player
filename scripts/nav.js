const init = async () => {
    window.addEventListener("DOMContentLoaded", function () {
        const burger = document.querySelector(".burger"),
            nav = document.querySelector(".navbar"),
            navLinks = nav.querySelectorAll("a");
        
        burger.addEventListener("click", function () {
            toggleClass(burger, "is-active");
            toggleClass(nav, "is-active");
        });

        navLinks.forEach(link => {
            link.addEventListener("click", function () {
                if (burger.classList.contains("is-active")) {
                    toggleClass(burger, "is-active");
                    toggleClass(nav, "is-active");
                }
            });
        });
    });

    function toggleClass(element, className) {
        if (element.classList.contains(className)) {
            element.classList.remove(className);
        } else {
            element.classList.add(className);
        }
    }
}

init();