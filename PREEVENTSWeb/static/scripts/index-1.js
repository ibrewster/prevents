$(document).ready(function(){
    $(document).on('change','.plotSelect', genPlot);
    $(document).on('click','div.removePlot',removePlotDiv);
    $(document).on('click','div.download',downloadPlotData);

    //set date range to last five years
    const curDate=new Date();
    let curMonth=curDate.getUTCMonth()+1
    if(curMonth<10){
        curMonth=`0${curMonth}`
    }

    let curDay=curDate.getUTCDate();
    if(curDay<10){
        curDay=`0${curDay}`;
    }

    const curYear=curDate.getUTCFullYear();
    const dateTo=`${curYear}-${curMonth}-${curDay}`
    const dateFrom=`${curYear-10}-${curMonth}-${curDay}`

    $('#dateFrom').val(dateFrom);
    $('#dateTo').val(dateTo);

    $('#addPlot').click(function(){createPlotDiv()});
    $('.rangeDate').blur(refreshPlots);
    $('#volcano').change(refreshPlots);

    $('#print').click(sizeAndPrint);

    // Create one plot by default, the color code plot
    createPlotDiv('General|Color Code')

});

function downloadPlotData(){
    const plot=$(this).closest('.plot').find('.js-plotly-plot').get(0);
    const type=$(this).siblings('.plotSelect').find('option:selected').val();

    let category,label;
    [category,label] = type.split('|');

    // not using these at the moment, as the data downloaded 
    // may not be limited to the displayed date range.
    const dateFrom=$('#dateFrom').val();
    const dateTo=$('#dateTo').val();

    const x=plot.data[0].x;
    const y=plot.data[0].y;

    let csvContent="data:text/csv;charset=utf-8,"
    for(let i=0;i<x.length;i++){
        csvContent+=`${x[i]},${y[i]}\r\n`
    }

    const encodedUri=encodeURI(csvContent);
    const volc=$('.volcWrapper:visible').data('volc');
    const file_name=`${category}_${label}_${x[0]}_${x[x.length-1]}.csv`

    $('#downloadLink')
    .attr('download',file_name)
    .attr('href',encodedUri)
    .get(0)
    .click()
}

function sizeAndPrint(){
    const WIDTH=768; //~8 inches
    $('.plotContent').each(function(){
        Plotly.relayout(this,{'width':WIDTH});
        Plotly.Plots.resize(this);
    });
    calcPageBreaks();

    //slight delay here so things can figure themselves out
    setTimeout(function(){
        window.print();

        $('.plotContent').each(function(){
           Plotly.relayout(this,{'width':null});
           Plotly.Plots.resize(this);
        });
    },50)
}

const PAGE_HEIGHT=984;

function calcPageBreaks(){
    let lastPage=0;
    const plotsTop=$('#plots').offset().top
    $('div.plot').each(function(){
        const plotContainer=$(this);
        const plotHeight=$(this).height();
        // Find the "print" height of the top of this div.
        const plotTop=plotContainer.offset().top-plotsTop;
        const plotBottom=plotTop+plotHeight;
        if(plotBottom>lastPage+PAGE_HEIGHT){
            plotContainer.addClass('pagebreak');
            lastPage+=PAGE_HEIGHT;
        }
        else{
            plotContainer.removeClass('pagebreak');
        }

    });
}

function createPlotDiv(type){
    const dest=$('#plots')
    const div=$('<div class="plot">')
    const typeSelect=$('<select class="plotSelect">')
    typeSelect.append('<option value="">Select...</option>')

    for(const plot of plotTypes){
        let opt;
        if(typeof(plot)=='string' && plot.startsWith('-')){
            opt=`<optgroup label="${plot}"></optgroup`
        }
        else{
            let tag,label;
            [tag,label]=plot
            opt=$('<option>');
            opt.text(label)
            opt.val(tag)
            if(typeof(type)!='undefined' && type==tag){
                opt.attr('selected',true)
            }
        }
        typeSelect.append(opt)
    }
    const selectDiv=$('<div class="typeSelectWrapper">')
    selectDiv.append(typeSelect)

    const downloadDiv=$('<div class="download">');
    downloadDiv.html(downloadSVG());
    selectDiv.append(downloadDiv);

    div.append(selectDiv)
    div.append('<div class="plotContent"><div class="placeholder"><---Select a plot type</div></div>')
    div.append('<div class=removePlot>&times;</div>')
    dest.append(div)

    if(typeof(type)!=='undefined'){
        typeSelect.change()
    }
}

function refreshPlots(){
    $('select.plotSelect').each(function(){
        genPlot.call(this);
    });
}

function clearDateAxis(setLast){
    $('.js-plotly-plot:not(.spatial)').each(function(){
        Plotly.relayout(this,{'xaxis.showticklabels':false})
    });

    if(setLast===true){
        const lastPlot=$('.js-plotly-plot:not(.spatial):last').get(0)
        Plotly.relayout(lastPlot,{'xaxis.showticklabels':true})
    }
}

function setLayoutDefaults(layout,showLabels){
    const dateFrom=$('#dateFrom').val();
    const dateTo=$('#dateTo').val();
    const range=[dateFrom,dateTo];
    const left_margin=90;
    const right_margin=10;


    if('xaxis' in layout){
        layout['xaxis']['range']=range;
        layout['xaxis']['type']='date';
        layout['xaxis']['autorange']=false;
        layout['xaxis']['showticklabels']=showLabels;
        layout['xaxis']['gridcolor']='#373A3F';
        layout['xaxis']['tickfont']={
            'size':14,
            'color':'rgb(204,204,220)'
        }
    }
    else{
        layout['xaxis']={
            range:range,
            type:'date',
            autorange:false,
            showticklabels:showLabels,
            gridcolor:'#373A3F',
            tickfont:{
                'size':14,
                'color':'rgb(204,204,220)'
            }
        }
    }

    //top-level layout stuff
    layout['paper_bgcolor']='rgba(0,0,0,0)'
    layout['plot_bgcolor']='rgba(0,0,0,0)'

    if('margin' in layout){
        layout['margin']['l']=left_margin;
        layout['margin']['r']=right_margin;
    }
    else{
        layout['margin']={'l':left_margin,'r':right_margin}
    }

    if('yaxis' in layout){
        layout['yaxis']['color']='rgb(204,204,220)'
        layout['yaxis']['gridcolor']='#373A3F'
    }

    return layout;
}

let isSpatial=false;
function genPlot(){
    const plotDiv=$(this).parent().siblings('div.plotContent');
    const plotContainer=$(this).closest('div.plot');

    plotDiv.find('.placeholder').remove();

    const plotElement=plotDiv.get(0);
    const showXLabels=plotContainer.is(':last-child');

    const plotType=this.value;
    const volcano=$('#volcano').val()
    const dateFrom=$('#dateFrom').val()
    const dateTo=$('#dateTo').val()

    $.getJSON('getPlot',{
        'plotType':plotType,
        'volcano':volcano,
        'dateFrom':dateFrom,
        'dateTo':dateTo
    }).done(function(data){
        let plotData,layout;
        const plotFunc=plotFuncs[plotType];

        isSpatial=false;
        [plotData,layout]=window[plotFunc](data);

        if(isSpatial){
            plotDiv.addClass('spatial');
        }
        else{
            plotDiv.removeClass('spatial');
        }

        config={'responsive':true}

        layout=setLayoutDefaults(layout,showXLabels)

        Plotly.newPlot(plotElement,plotData,layout,config);

        plotElement.removeListener('plotly_relayout',plotRangeChanged)
        plotElement.on('plotly_relayout',plotRangeChanged);


    }).fail(function(e){
        if(e.status==404){
            Plotly.purge(plotDiv);
            $(plotDiv).empty();
            const errorPlaceholder=$('<div class="placeholder error">')
            errorPlaceholder.html(`Unable to show plot for selected volcano/plot type.
            <br>No data found for this selection`);
            $(plotDiv).append(errorPlaceholder)
        }
        else{
            alert(`Error generating plot: ${e.status}, ${e.responseText}`)
        }
    }).always(function(){
        clearDateAxis(true);
    })
}

function plotRangeChanged(eventdata){
    if(!('xaxis.range[0]' in eventdata) ){
        return;
    }
    const dateFrom=eventdata['xaxis.range[0]'].slice(0,10)
    const dateTo=eventdata['xaxis.range[1]'].slice(0,10)
    $('#dateFrom').val(dateFrom);
    $('#dateTo').val(dateTo);
    refreshPlots();
}

function removePlotDiv(){
    $(this).closest('div.plot').remove();
    clearDateAxis(true);
}


function downloadSVG(){
    return `
<svg height="32pt" version="1.1" viewBox="0 0 370.9 527.96" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(-180.99 -17.213)">
  <path d="m391.4 449.97v-78.805h-49.695v78.805h-54.891l80.676 95.207 80.676-95.207z"/>
  <path d="m525.74 172.65v-42.344c0-2.2188-0.92969-4.4727-2.4883-6.0547l-103.16-104.48c-1.3438-1.6797-4.0625-2.5586-6.1289-2.5586h-197.29c-4.7578 0-8.6172 3.8555-8.6172 8.6172v146.82h-27.066v171.07h27.066v72.461c0 4.7617 3.8555 8.6172 8.6172 8.6172h110.66v-17.23l-102.05-4e-3v-63.848h283.21v63.848h-102.75v17.23h111.37c4.7578 0 8.6172-3.8555 8.6172-8.6172v-72.461h26.156v-171.07zm-103.16-125.84 73.914 74.887h-73.914zm-117.1 236.32c5.2852 0 11.141-1.1484 14.59-2.5273l2.6406 13.668c-3.2148 1.6094-10.449 3.332-19.867 3.332-26.762 0-40.543-16.652-40.543-38.707 0-26.418 18.836-41.117 42.266-41.117 9.0742 0 15.965 1.8398 19.066 3.4453l-3.5625 13.898c-3.5625-1.4922-8.5-2.8711-14.699-2.8711-13.898 0-24.695 8.3867-24.695 25.613 0 15.5 9.1875 25.266 24.805 25.266zm53.418 14.469c-8.8438 0-17.574-2.3008-21.938-4.7109l3.5625-14.473c4.7109 2.4141 11.945 4.8203 19.41 4.8203 8.043 0 12.289-3.3281 12.289-8.3828 0-4.8242-3.6758-7.582-12.98-10.91-12.863-4.4805-21.25-11.602-21.25-22.855 0-13.207 11.023-23.316 29.289-23.316 8.7266 0 15.16 1.8398 19.754 3.9062l-3.9023 14.125c-3.1016-1.4922-8.6172-3.6758-16.195-3.6758-7.582 0-11.254 3.4453-11.254 7.4648 0 4.9414 4.3633 7.1211 14.355 10.914 13.668 5.0508 20.102 12.172 20.102 23.086 0 12.98-9.9922 24.008-31.242 24.008zm87.527-1.1484h-20.441l-24.809-77.41h19.18l9.418 32.734c2.6406 9.1914 5.0547 18.031 6.8906 27.68h0.34375c1.9531-9.3047 4.3633-18.492 7.0039-27.336l9.875-33.078h18.605zm62.082-123.8h-283.21v-138.2h180.05v95.855c0 4.7578 3.8555 8.6172 8.6172 8.6172h94.547z"/>
 </g>
</svg>
    `
}