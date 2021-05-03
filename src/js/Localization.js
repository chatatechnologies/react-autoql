import LocalizedStrings from 'react-localization'

export const lang = new LocalizedStrings({
    en: {
        introPrompt: "Some things you can ask me: ",
        use: "Use",
        exploreQueries: "Explore Queries",
        explorePrompt: "to further explore the possibilities.",
        run: "We run on AutoQL by Chata",
        queryPrompt: "Type your queries here ",
        seeMore: "See more",
        clearDataResponses: "Clear data responses",
        closeDataMessenger: "Close Data Messenger",
        searchQueries: "Search relevant queries by topic",
        discoverPrompt: "Discover what you can ask by entering a topic in the search bar above. Simply click on any of the returned options to run the query in Data Messenger.",
        reportAProblem: "Report a problem",
        deleteDataResponse: "Delete data response",
        table: "Table",
        barChart: "Bar Chart",
        columnChart: "Column Chart",
        lineChart: "Line Chart",
        pieChart: "Pie Chart",
        heatMap: "Heat Map",
        bubbleChart: "Bubble Chart",
        stackedColumnChart: "Stacked Column Chart",
        stackedBarChart: "Stacked Bar Chart",
        stackedAreaChart: "Stacked Area Chart",
        downloadAsPNG: "Download as a PNG",
        filterTable: "Filter table",
        showHideColumns: "Show/hide columns",
        downloadAsCSV: "Download as a CSV",
        copyTableToClipboard: "Copy table to clipboard",
        filterColumn: "Filter column",
        columnName: "Column Name",
        visibility: "Visibility",
        cancel: "Cancel",
        apply: "Apply"
    },
    sp: {
        introPrompt: "Cosas que puedes preguntarme:",
        use: "Utiliza",
        exploreQueries: "Explorar Consultas",
        explorePrompt: "para ampliar las posibilidades.",
        run: "Corremos en AutoQL de Chata",
        queryPrompt: "Escribe tus consultas aquí",
        seeMore: "Ver más",
        clearDataResponses: "Limpiar respuestas",
        closeDataMessenger: "Cerrar Data mesenger",
        searchQueries: "Buscar consultas relevantes por tema",
        discoverPrompt: "Descubre lo que puede preguntar ingresando un tema en la barra de búsqueda de arriba. Da clic en cualquiera de las opciones devueltas para ejecutar la consulta en Data Messenger.",
        reportAProblem: "Informar de un problema",
        deleteDataResponse: "Eliminar respuesta de datos",
        table: "Tabla",
        barChart: "Gráfico de barras",
        columnChart: "Gráfico de columnas",
        lineChart: "Gráfico de linea",
        pieChart: "Gráfico circular",
        heatMap: "Mapa de calor",
        bubbleChart: "Gráfico de burbujas",
        stackedColumnChart: "Gráfico de columnas apiladas",
        stackedBarChart: "Gráfico de barras apiladas",
        stackedAreaChart: "Gráfico de área apilada",
        downloadAsPNG: "Descargar como PNG",
        filterTable: "Tabla de filtros",
        showHideColumns: "Mostrar/ocultar columnas",
        downloadAsCSV: "Descargar como CSV",
        copyTableToClipboard: "Copiar tabla al portapapelas",
        filterColumn: "Columna de filtro",
        columnName: "Nombre de columna",
        visibility: "Visibilidad",
        cancel: "Cancelar",
        apply: "Aplicar"
    }
})

export const setLanguage = () => {
    var userLang = navigator.language || navigator.userLanguage;
    if (userLang.includes("sp")) {
        lang.setLanguage("sp")
    }
    else {
        lang.setLanguage("en")
    }
}