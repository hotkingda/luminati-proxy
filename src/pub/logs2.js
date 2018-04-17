// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import moment from 'moment';
import classnames from 'classnames';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zurl from 'hutil/util/url';
import zescape from 'hutil/util/escape';
import util from './util.js';
import filesaver from 'file-saver';
import Autosuggest from 'react-autosuggest';
import {If} from '/www/util/pub/react.js';
import $ from 'jquery';
import {Tooltip, Link_icon, Loader} from './common.js';

class Logs extends Pure_component {
    moving = false;
    min_width = 22;
    state = {
        cur_preview: null,
        network_width: 200,
        reqs: [],
    };
    componentWillMount(){
        this.get_data();
    }
    componentDidMount(){
        window.document.addEventListener('mousemove',
            this.on_mouse_move.bind(this));
        window.document.addEventListener('mouseup',
            this.on_mouse_up.bind(this));
    }
    open_preview(req){
        this.setState({cur_preview: req}); }
    close_preview(){
        this.setState({cur_preview: null}); }
    start_moving(e){
        if (e.nativeEvent.which!=1)
            return;
        this.moving = true;
        $(this.main_panel).addClass('moving');
        this.start_offset = e.pageX;
        this.start_width = this.state.network_width;
    }
    on_mouse_move(e){
        if (!this.moving)
            return;
        const offset = e.pageX-this.start_offset;
        let new_width = this.start_width+offset;
        if (new_width<this.min_width)
            new_width = this.min_width;
        this.setState(prev=>{
            return {network_width: new_width};
        });
    }
    on_mouse_up(){
        this.moving = false;
        $(this.main_panel).removeClass('moving');
    }
    get_data(){
        const _this = this;
        this.etask(function*(){
            const uri = '/api/logs';
            const params = {limit: 0, skip: 0};
            const url = zescape.uri(uri, params);
            const res = yield ajax.json({url});
            _this.setState({reqs: res.log.entries, total: res.total});
        });
    }
    set_main_panel_ref(ref){ this.main_panel = ref; }
    render(){
        return (
            <div className="har_viewer">
              <div className="main_panel vbox"
                ref={this.set_main_panel_ref.bind(this)}>
                <div className="split_widget vbox flex_auto">
                  <Network_container
                    reqs={this.state.reqs}
                    main_panel={this.main_panel}
                    open_preview={this.open_preview.bind(this)}
                    width={this.state.network_width}
                    cur_preview={this.state.cur_preview}/>
                  <Preview cur_preview={this.state.cur_preview}
                    close_preview={this.close_preview.bind(this)}/>
                  <Network_resizer show={!!this.state.cur_preview}
                    start_moving={this.start_moving.bind(this)}
                    offset={this.state.network_width}/>
                </div>
              </div>
            </div>
        );
    }
}

const Network_resizer = ({show, offset, start_moving})=>{
    if (!show)
        return null;
    return (
        <div className="data_grid_resizer" style={{left: offset-2}}
          onMouseDown={start_moving}/>
    );
};

class Network_container extends Pure_component {
    moving_col = null;
    min_width = 22;
    cols = ['Name', 'Status', 'Port', 'Bandwidth', 'Super proxy'];
    state = {
        cols: this.cols.map(c=>({title: c, width: 0, offset: 0})),
        focused: false,
    };
    componentDidMount(){
        this.resize_columns();
        window.onresize = ()=>{
            this.resize_columns();
        };
        window.document.addEventListener('mousemove',
            this.on_mouse_move.bind(this));
        window.document.addEventListener('mouseup',
            this.on_mouse_up.bind(this));
    }
    componentWillUnmount(){
        window.onresize = null;
    }
    componentDidUpdate(prev_props){
        if (prev_props.cur_preview!=this.props.cur_preview)
            this.resize_columns();
    }
    on_focus(){ this.setState({focused: true}); }
    on_blur(){ this.setState({focused: false}); }
    on_mouse_up(){
        this.moving_col = null;
        $(this.props.main_panel).removeClass('moving');
    }
    resize_columns(){
        const total_width = this.network_container.offsetWidth;
        const width = total_width/this.state.cols.length;
        const cols = this.state.cols.map((c, idx)=>({...c, width,
            offset: width*idx}));
        this.setState({cols});
    }
    start_moving(e, idx){
        if (e.nativeEvent.which!=1)
            return;
        $(this.props.main_panel).addClass('moving');
        this.moving_col = idx;
        this.start_offset = e.pageX;
        this.start_width = this.state.cols[idx].width;
        this.start_width_last = this.state.cols.slice(-1)[0].width;
    }
    on_mouse_move(e){
        if (this.moving_col===null)
            return;
        this.setState(prev=>{
            let offset = e.pageX-this.start_offset;
            if (this.start_width_last-offset<this.min_width)
                offset = this.start_width_last-this.min_width;
            if (this.start_width+offset<this.min_width)
                offset = this.min_width-this.start_width;
            let total_width = 0;
            const cols = prev.cols.map((c, idx)=>{
                if (idx<this.moving_col)
                {
                    total_width = total_width+c.width;
                    return c;
                }
                else if (idx==this.moving_col)
                {
                    const width = this.start_width+offset;
                    total_width = total_width+width;
                    return {...c, width, offset: total_width-width};
                }
                else if (idx==this.state.cols.length-1)
                {
                    const width = this.start_width_last-offset;
                    return {...c, width, offset: total_width};
                }
                total_width = total_width+c.width;
                return {...c, offset: total_width-c.width};
            });
            return {cols};
        });
    }
    set_network_ref(ref){ this.network_container = ref; }
    render(){
        const style = {};
        if (!!this.props.cur_preview)
            style.flex = `0 0 ${this.props.width}px`;
        return (
            <div className="network_container"
              tabIndex="-1"
              style={style}
              onFocus={this.on_focus.bind(this)}
              onBlur={this.on_blur.bind(this)}
              ref={this.set_network_ref.bind(this)}>
              <Header_container cols={this.state.cols}
                only_name={!!this.props.cur_preview}/>
              <Data_container cols={this.state.cols}
                reqs={this.props.reqs}
                focused={this.state.focused}
                cur_preview={this.props.cur_preview}
                open_preview={this.props.open_preview}/>
              <Grid_resizers cols={this.state.cols}
                show={!this.props.cur_preview}
                start_moving={this.start_moving.bind(this)}/>
            </div>
        );
    }
}

const Grid_resizers = ({cols, start_moving, show})=>{
    if (!show)
        return null;
    return (
        <div>
          {cols.slice(0, -1).map((c, idx)=>(
            <div key={c.title} style={{left: c.width+c.offset-2}}
              onMouseDown={e=>start_moving(e, idx)}
              className="data_grid_resizer"/>
          ))}
        </div>
    );
};

const Header_container = ({cols, only_name})=>{
    if (only_name)
        cols = cols.slice(0, 1);
    return (
        <div className="header_container">
          <table>
            <colgroup>
              {cols.map(c=>(
                <col key={c.title}
                  style={{width: only_name ? 'auto' : c.width}}/>
              ))}
            </colgroup>
            <tbody>
              <tr>
                {cols.map(c=>(
                  <th key={c.title}>
                    <div>{c.title}</div>
                    <div className="sort_icon"/>
                  </th>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
    );
};

const Data_container = ({cols, open_preview, cur_preview, focused, reqs})=>{
    const preview_mode = !!cur_preview;
    if (preview_mode)
        cols = cols.slice(0, 1);
    return (
        <div className="data_container">
          <table>
            <colgroup>
              {cols.map(c=>(
                <col key={c.title}
                  style={{width: !!cur_preview ? 'auto' : c.width}}/>
              ))}
            </colgroup>
            <Data_rows reqs={reqs}
              cols={cols}
              open_preview={open_preview}
              cur_preview={cur_preview}
              focused={focused}/>
          </table>
        </div>
    );
};

class Data_rows extends React.Component {
    shouldComponentUpdate(next_props){
        return next_props.reqs.length!=this.props.reqs.length ||
            next_props.cur_preview!=this.props.cur_preview ||
            next_props.focused!=this.props.focused;
    }
    render(){
        return (
            <tbody>
              {this.props.reqs.map((r, i)=>(
                <Data_row cols={this.props.cols} key={r.uuid} i={i}
                  open_preview={this.props.open_preview}
                  cur_preview={this.props.cur_preview}
                  focused={this.props.focused} req={r}/>
              ))}
              <tr className="filler">
                {this.props.cols.map(c=><td key={c.title}/>)}
              </tr>
            </tbody>
        );
    }
}

const Data_row = ({cur_preview, i, open_preview, cols, focused, req})=>{
    const classes = classnames({
        odd: i%2==0,
        selected: cur_preview==req,
        focused: cur_preview==req&&focused,
    });
    return (
        <tr key={i} className={classes}>
          {cols.map(c=>(
            <td key={c.title} onClick={()=>open_preview(req)}>
              <Cell_value col={c.title} req={req}/>
            </td>
          ))}
        </tr>
    );
};

const Cell_value = ({col, req})=>{
    if (col=='Name')
    {
        return (
            <span>
              <img className="icon script"/>
              <span>{req.request.url}</span>
            </span>
        );
    }
    else if (col=='Status')
        return req.response.status;
    else if (col=='Port')
        return req.details.port;
    else if (col=='Bandwidth')
        return util.bytes_format(req.details.bw);
    else if (col=='Super proxy')
        return req.details.proxy_peer;
    return col;
};

class Preview extends Pure_component {
    panes = [
        {id: 'headers', width: 65, comp: Pane_headers},
        {id: 'preview', width: 63, comp: Pane_preview},
        {id: 'response', width: 72, comp: Pane_empty},
        {id: 'timing', width: 57, comp: Pane_empty},
    ];
    state = {cur_pane: 0};
    select_pane = id=>{ this.setState({cur_pane: id}); };
    render(){
        if (!this.props.cur_preview)
            return null;
        const Pane_content = this.panes[this.state.cur_pane].comp;
        return (
            <div className="preview_container">
              <div className="tabbed_pane_header">
                <div className="left_pane">
                  <div onClick={this.props.close_preview}
                    className="close_btn_wrapper">
                    <div className="small_icon close_btn"/>
                    <div className="medium_icon close_btn_h"/>
                  </div>
                </div>
                <div className="right_panes">
                  {this.panes.map((p, idx)=>(
                    <Pane key={p.id} width={p.width} id={p.id} idx={idx}
                      on_click={this.select_pane.bind(this)}
                      active={this.state.cur_pane==idx}/>
                  ))}
                  <Pane_slider panes={this.panes}
                    cur_pane={this.state.cur_pane}/>
                </div>
              </div>
              <div className="tabbed_pane_content">
                <Pane_content req={this.props.cur_preview}/>
              </div>
            </div>
        );
    }
}

const Pane_slider = ({panes, cur_pane})=>{
    const slider_class = classnames('pane_slider');
    const offset = panes.slice(0, cur_pane).reduce((acc, e)=>acc+e.width, 0);
    const slider_style = {
        width: panes[cur_pane].width,
        transform: `translateX(${offset}px)`,
    };
    return <div className={slider_class} style={slider_style}/>;
};

const Pane = ({id, idx, width, on_click, active})=>(
    <div onClick={()=>on_click(idx)} style={{width}}
      className={classnames('pane', id, {active})}>
      <span>{id}</span>
    </div>
);

class Pane_headers extends React.Component {
    render(){
        const {req} = this.props;
        const general_entries = [{name: 'Request URL', value: req.request.url},
            {name: 'Status Code', value: req.response.status}];
        return (
            <ol className="tree_outline">
              <Preview_section title="General" pairs={general_entries}/>
              <Preview_section title="Response headers"
                pairs={req.response.headers}/>
              <Preview_section title="Request headers"
                pairs={req.request.headers}/>
             </ol>
        );
    }
}

class Preview_section extends React.Component {
    state = {open: true};
    toggle(){ this.setState(prev=>({open: !prev.open})); }
    render(){
        return [
            <li key="li" onClick={this.toggle.bind(this)}
              className={classnames('parent', {open: this.state.open})}>
              {this.props.title}
              {!this.state.open ? ` (${this.props.pairs.length})` : ''}
            </li>,
            <ol key="ol"
              className={classnames('children', {open: this.state.open})}>
              {this.props.pairs.map(p=>(
                <Header_pair key={p.name} name={p.name} value={p.value}/>
              ))}
            </ol>
        ];
    }
}

const Header_pair = ({name, value})=>(
    <li className="treeitem">
      <div className="header_name">{name}: </div>
      <div className="header_value">{value}</div>
    </li>
);

const Pane_empty = ()=>null;

const Pane_preview = ()=>(
    <div className="pane_preview">
      preview
    </div>
);

export default Logs;