import { Component } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-table-widget',
  standalone : true,
  imports : [MatTableModule],
  templateUrl: './table-widget.component.html',
  styleUrls: ['./table-widget.component.css']
})
export class TableWidgetComponent {
  displayedColumns: string[] = ['name', 'progress', 'color'];
  dataSource = [
    { name: 'John', progress: '80%', color: 'blue' },
    { name: 'Alice', progress: '90%', color: 'green' },
    { name: 'Bob', progress: '70%', color: 'red' }
  ];
}
